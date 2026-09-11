import type { RunId } from '@convex-dev/action-retrier'
import { ConvexError, v } from 'convex/values'
import { internal } from '../../_generated/api'
import { action, internalMutation } from '../../_generated/server'
import * as imageStore from '../../lib/imageStore'
import { invariant } from '../../lib/invariant'
import { assertExtractionEnabled, rateLimiter } from '../../lib/rateLimits'
import { retrier } from '../../lib/retrier'
import { assertHostToken, assertScanOpen, now } from '../../model/bills'
import {
  assertDeviceId,
  billMutation,
  deviceLimitedMutation,
} from '../lib/functions'

// Scan mutations are public and unauthenticated, and extraction is the only
// paid path — so both steps are rate limited per device (client-generated id;
// honest-user guardrail) with a global daily budget as the real backstop.

const DEVICE_BUSY = 'Too many scans from this device — try again in a bit.'

// The emergency brake runs before the limiter so a paused scanner doesn't
// burn the device's tokens.
const uploadUrlMutation = deviceLimitedMutation(
  'uploadUrlPerDevice',
  DEVICE_BUSY,
  assertExtractionEnabled,
)
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024

export const generateUploadUrl = uploadUrlMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await imageStore.createUploadTarget(ctx)
  },
})

// The upload has already completed by the time this is called. Keep all
// validation and scheduling in a private transaction, then wrap it in an
// action so a rejected transaction can still delete the uploaded image. A
// mutation could not do both: throwing would roll its storage deletion back.
export const prepareImageExtraction = internalMutation({
  args: {
    id: v.id('bills'),
    hostToken: v.string(),
    deviceId: v.string(),
    imageRef: v.id('_storage'),
  },
  returns: v.null(),
  handler: async (ctx, { id, hostToken, deviceId, imageRef }) => {
    assertDeviceId(deviceId)
    assertExtractionEnabled()
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertHostToken(bill, hostToken)
    assertScanOpen(bill)

    const image = await ctx.db.system.get('_storage', imageRef)
    if (!image) {
      throw new ConvexError('Receipt image not found. Please scan again.')
    }
    if (
      (image.contentType && !image.contentType.startsWith('image/')) ||
      image.size > MAX_RECEIPT_BYTES
    ) {
      throw new ConvexError('That receipt image is invalid or too large.')
    }

    const currentOwner = await ctx.db
      .query('bills')
      .withIndex('by_imageRef', (q) => q.eq('imageRef', imageRef))
      .first()
    if (currentOwner && currentOwner._id !== bill._id) {
      throw new ConvexError('That receipt upload is already in use.')
    }
    if (bill.imageRef === imageRef && bill.extractionRunId !== undefined) {
      // Idempotent retry after the scheduling transaction committed but its
      // response was lost. Do not spend another rate-limit token or create a
      // second run competing over the same image.
      return null
    }

    const device = await rateLimiter.limit(ctx, 'extractPerDevice', {
      key: deviceId,
    })
    if (!device.ok) throw new ConvexError(DEVICE_BUSY)

    const global = await rateLimiter.limit(ctx, 'extractGlobalDaily')
    if (!global.ok) {
      // Surfaces in the Convex dashboard logs (and any log stream wired to it).
      // The daily budget tripping is the one spend event worth noticing: either
      // real demand outgrew the cap in convex/lib/rateLimits.ts, or someone is
      // burning it. Without this line the first signal is a user complaint.
      console.error(
        '[spend] extractGlobalDaily exhausted — scanning paused until the window resets',
      )
      throw new ConvexError(
        'Spolio is very busy today and scanning is paused. Try again later or enter the bill manually.',
      )
    }

    const billId = bill._id
    // Run under the retrier: transient vision failures back off and retry, and
    // only the run's final outcome reaches onExtractionComplete.
    const runId = await retrier.run(
      ctx,
      internal.extraction.actions.extractReceipt,
      { billId, imageRef },
      { onComplete: internal.bills.extraction.onExtractionComplete },
    )
    if (bill.imageRef && bill.imageRef !== imageRef) {
      // A re-scan supersedes the previous run. Its action may already have the
      // bytes in memory, but applyExtraction rejects stale refs; release the
      // stored copy now and let the retention sweep retry any delete failure.
      try {
        await imageStore.deleteImage(ctx, bill.imageRef)
      } catch (error) {
        console.error('[privacy] failed to delete superseded receipt upload', {
          imageRef: bill.imageRef,
          error: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }
    // New attempt: clear any previous failure so the review UI resets.
    await ctx.db.patch(billId, {
      imageRef,
      extractionError: undefined,
      extractionRunId: runId,
      extractionBaseVersion: bill.version,
      updatedAt: Date.now(),
    })
    return null
  },
})

// Cleanup for a rejected attach must be ownership-aware: a retry can arrive
// after the first attach committed but before its response reached the client.
// Deleting blindly in that case would pull the image out from under the live
// extraction. Keeping the query and delete in one mutation closes that race.
export const discardUnreferencedUpload = internalMutation({
  args: { imageRef: v.id('_storage') },
  returns: v.boolean(),
  handler: async (ctx, { imageRef }) => {
    const owner = await ctx.db
      .query('bills')
      .withIndex('by_imageRef', (q) => q.eq('imageRef', imageRef))
      .first()
    if (owner) return false
    await imageStore.deleteImage(ctx, imageRef)
    return true
  },
})

// "Taking long? Enter items manually" — the escape hatch out of the processing
// screen (ux-flow-and-motion-plan.md §5). Detaches the bill from its in-flight
// extraction so the host can type the items in without a late vision result
// landing on top of them: applyExtraction bails on a mismatched imageRef, and
// onExtractionComplete resolves runs through by_extractionRunId, which no
// longer matches this bill. Cancelling the run and deleting the image are best
// effort — correctness comes from clearing the pointers, and the hourly
// retention sweep is the durable delete path.
export const abandonExtraction = billMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const bill = ctx.bill
    assertScanOpen(bill)
    if (bill.extractionRunId !== undefined) {
      try {
        await retrier.cancel(ctx, bill.extractionRunId as RunId)
      } catch {
        // Throws when the run is already finished or not yet executing.
      }
    }
    if (bill.imageRef) {
      try {
        await imageStore.deleteImage(ctx, bill.imageRef)
      } catch (error) {
        console.error('[privacy] failed to delete abandoned receipt upload', {
          imageRef: bill.imageRef,
          error: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }
    // Status is deliberately untouched (a PENDING bill stays PENDING) and the
    // version is not bumped: nothing the user can see changed.
    await ctx.db.patch(bill._id, {
      imageRef: undefined,
      extractionRunId: undefined,
      extractionBaseVersion: undefined,
      extractionError: undefined,
      updatedAt: now(),
    })
    return null
  },
})

export const attachImageAndExtract = action({
  args: {
    id: v.id('bills'),
    hostToken: v.string(),
    deviceId: v.string(),
    imageRef: v.id('_storage'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const scheduled: null = await ctx.runMutation(
        internal.bills.host.uploads.prepareImageExtraction,
        args,
      )
      return scheduled
    } catch (error) {
      try {
        const deleted: boolean = await ctx.runMutation(
          internal.bills.host.uploads.discardUnreferencedUpload,
          { imageRef: args.imageRef },
        )
        if (!deleted) {
          console.info(
            '[privacy] rejected attach kept an upload owned by an active extraction',
            { imageRef: args.imageRef },
          )
        }
      } catch (deleteError) {
        // The hourly storage sweep is the durable retry path. Log identifiers,
        // never image contents.
        console.error('[privacy] failed to delete rejected receipt upload', {
          imageRef: args.imageRef,
          error:
            deleteError instanceof Error
              ? deleteError.message
              : 'unknown error',
        })
      }
      throw error
    }
  },
})
