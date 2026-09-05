import { cronJobs } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import * as imageStore from './lib/imageStore'
import { deleteClaimRowsForBill } from './model/claimRows'

// Bills are anonymous and unowned in the MVP, so they must not accumulate
// forever (spec §10 asks for a TTL). A bill untouched for BILL_TTL_MS is
// purged. Aggregate edits bump updatedAt directly; claim changes retain their
// activity timestamp on claim rows and are rolled up below before deletion.
const BILL_TTL_MS = 60 * 24 * 60 * 60 * 1000 // 60 days
// Each bill cascades to its claim rows, so keep the batch small enough that
// batch × claims-per-bill stays well inside one transaction's write budget.
const PURGE_BATCH = 50

export const purgeStaleBills = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - BILL_TTL_MS
    const candidates = await ctx.db
      .query('bills')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', cutoff))
      .take(PURGE_BATCH)
    for (const bill of candidates) {
      const latestClaim = await ctx.db
        .query('claims')
        .withIndex('by_bill_and_updatedAt', (q) => q.eq('billId', bill._id))
        .order('desc')
        .first()
      const claimActivityAt = latestClaim?.updatedAt ?? latestClaim?._creationTime
      if (claimActivityAt !== undefined && claimActivityAt >= cutoff) {
        // Move the aggregate back into its correct position in by_updatedAt.
        // This happens in the maintenance path, so claim taps remain isolated
        // row writes and don't contend on the bill document.
        await ctx.db.patch(bill._id, { updatedAt: claimActivityAt })
        continue
      }

      if (bill.imageRef) {
        try {
          await imageStore.deleteImage(ctx, bill.imageRef)
        } catch (error) {
          // Deleting the bill removes the reference. The hourly storage sweep
          // below is the durable retry path for the now-orphaned upload.
          console.error('[privacy] failed to delete receipt for stale bill', {
            billId: bill._id,
            imageRef: bill.imageRef,
            error: error instanceof Error ? error.message : 'unknown error',
          })
        }
      }
      await deleteClaimRowsForBill(ctx, bill._id)
      await ctx.db.delete(bill._id)
    }
    // Full batch means there may be more; continue in a fresh transaction.
    if (candidates.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.crons.purgeStaleBills, {})
    }
    return null
  },
})

const IMAGE_TTL_MS = 24 * 60 * 60 * 1000
const IMAGE_PURGE_PAGE = 64
const MAX_IMAGE_REFERENCES = 10

// Convex storage is used only for temporary receipt uploads in this app. Sweep
// by storage creation time so even an upload whose attach request never arrived
// (or whose immediate deletion failed) has a hard retention backstop.
export const purgeExpiredReceiptImages = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    cutoff: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { cursor, cutoff: suppliedCutoff }) => {
    const cutoff = suppliedCutoff ?? Date.now() - IMAGE_TTL_MS
    const page = await ctx.db.system
      .query('_storage')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .paginate({ cursor, numItems: IMAGE_PURGE_PAGE })

    for (const image of page.page) {
      const references = await ctx.db
        .query('bills')
        .withIndex('by_imageRef', (q) => q.eq('imageRef', image._id))
        .take(MAX_IMAGE_REFERENCES)
      if (references.length === MAX_IMAGE_REFERENCES) {
        // New attaches enforce one owner per upload. Skip legacy/corrupt data
        // with an unexpectedly full batch rather than deleting a reference we
        // have not inspected.
        continue
      }

      for (const bill of references) {
        // Extraction normally finishes in seconds. Once its upload is a full
        // day old, retention wins over a wedged retrier: detach it and expose
        // the existing manual/rescan recovery UI. A late action cannot
        // overwrite the bill because applyExtraction checks imageRef.
        await ctx.db.patch(bill._id, {
          imageRef: undefined,
          ...(bill.extractionRunId !== undefined
            ? {
                extractionRunId: undefined,
                extractionError: "We couldn't read this receipt.",
                status:
                  bill.lineItems.length > 0
                    ? bill.status
                    : ('NEEDS_REVIEW' as const),
                version: bill.version + 1,
                updatedAt: Date.now(),
              }
            : {}),
        })
      }
      try {
        await imageStore.deleteImage(ctx, image._id)
      } catch (error) {
        console.error('[privacy] receipt retention sweep delete failed', {
          imageRef: image._id,
          error: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.crons.purgeExpiredReceiptImages,
        { cursor: page.continueCursor, cutoff },
      )
    }
    return null
  },
})

const crons = cronJobs()

crons.interval(
  'purge stale bills',
  { hours: 24 },
  internal.crons.purgeStaleBills,
  {},
)

crons.interval(
  'purge expired receipt images',
  { hours: 1 },
  internal.crons.purgeExpiredReceiptImages,
  { cursor: null, cutoff: null },
)

export default crons
