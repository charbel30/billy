import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { invariant } from '../lib/invariant'
import * as imageStore from '../lib/imageStore'
import { assertExtractionEnabled, rateLimiter } from '../lib/rateLimits'
import { retrier } from '../lib/retrier'

// Scan mutations are public and unauthenticated, and extraction is the only
// paid path — so both steps are rate limited per device (client-generated id;
// honest-user guardrail) with a global daily budget as the real backstop.

function assertDeviceId(deviceId: string) {
  if (deviceId.trim().length < 8) throw new ConvexError('Invalid device id')
}

export const generateUploadUrl = mutation({
  args: { deviceId: v.string() },
  returns: v.string(),
  handler: async (ctx, { deviceId }) => {
    assertDeviceId(deviceId)
    const { ok } = await rateLimiter.limit(ctx, 'uploadUrlPerDevice', {
      key: deviceId,
    })
    if (!ok) {
      throw new ConvexError(
        'Too many scans from this device — try again in a bit.',
      )
    }
    return await imageStore.createUploadTarget(ctx)
  },
})

export const attachImageAndExtract = mutation({
  args: {
    billId: v.id('bills'),
    imageRef: v.string(),
    deviceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { billId, imageRef, deviceId }) => {
    assertDeviceId(deviceId)
    assertExtractionEnabled()
    const perDevice = await rateLimiter.limit(ctx, 'extractPerDevice', {
      key: deviceId,
    })
    if (!perDevice.ok) {
      throw new ConvexError(
        'Too many scans from this device — try again in a bit.',
      )
    }
    const global = await rateLimiter.limit(ctx, 'extractGlobalDaily')
    if (!global.ok) {
      throw new ConvexError(
        "Billy is very busy today and scanning is paused. Try again later or enter the bill manually.",
      )
    }

    const bill = await ctx.db.get(billId)
    invariant(bill, `missing bill ${billId}`)
    // Run under the retrier: transient vision failures back off and retry, and
    // only the run's final outcome reaches onExtractionComplete.
    const runId = await retrier.run(
      ctx,
      internal.extraction.actions.extractReceipt,
      { billId, imageRef },
      { onComplete: internal.bills.extraction.onExtractionComplete },
    )
    // New attempt: clear any previous failure so the review UI resets.
    await ctx.db.patch(billId, {
      imageRef,
      extractionError: undefined,
      extractionRunId: runId,
      updatedAt: Date.now(),
    })
    return null
  },
})
