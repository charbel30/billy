import { ConvexError, v } from 'convex/values'
import { internal } from '../../_generated/api'
import * as imageStore from '../../lib/imageStore'
import { assertExtractionEnabled, rateLimiter } from '../../lib/rateLimits'
import { retrier } from '../../lib/retrier'
import {
  deviceLimitedBillMutation,
  deviceLimitedMutation,
} from '../lib/functions'

// Scan mutations are public and unauthenticated, and extraction is the only
// paid path — so both steps are rate limited per device (client-generated id;
// honest-user guardrail) with a global daily budget as the real backstop.

const DEVICE_BUSY = 'Too many scans from this device — try again in a bit.'

const uploadUrlMutation = deviceLimitedMutation('uploadUrlPerDevice', DEVICE_BUSY)
// The emergency brake runs before the limiter so a paused scanner doesn't
// burn the device's tokens.
// Extraction rewrites the bill's line items, so this one is a host write on top
// of being a scan step: deviceLimitedBillMutation takes `id` + `hostToken` and
// injects ctx.bill.
const extractMutation = deviceLimitedBillMutation(
  'extractPerDevice',
  DEVICE_BUSY,
  assertExtractionEnabled,
)

export const generateUploadUrl = uploadUrlMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await imageStore.createUploadTarget(ctx)
  },
})

export const attachImageAndExtract = extractMutation({
  args: {
    imageRef: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { imageRef }) => {
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
        "Spolio is very busy today and scanning is paused. Try again later or enter the bill manually.",
      )
    }

    const billId = ctx.bill._id
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
