import { ConvexError, v } from 'convex/values'
import { internal } from '../_generated/api'
import { invariant } from '../lib/invariant'
import * as imageStore from '../lib/imageStore'
import { assertExtractionEnabled, rateLimiter } from '../lib/rateLimits'
import { retrier } from '../lib/retrier'
import { deviceLimitedMutation } from './functions'

// Scan mutations are public and unauthenticated, and extraction is the only
// paid path — so both steps are rate limited per device (client-generated id;
// honest-user guardrail) with a global daily budget as the real backstop.

const DEVICE_BUSY = 'Too many scans from this device — try again in a bit.'

const uploadUrlMutation = deviceLimitedMutation('uploadUrlPerDevice', DEVICE_BUSY)
// The emergency brake runs before the limiter so a paused scanner doesn't
// burn the device's tokens.
const extractMutation = deviceLimitedMutation(
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
    billId: v.id('bills'),
    imageRef: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { billId, imageRef }) => {
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
