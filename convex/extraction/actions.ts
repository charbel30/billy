import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import * as imageStore from '../lib/imageStore'
import { callVisionModel } from './vision'

// Runs under the action retrier (scheduled by attachImageAndExtract): a thrown
// error is retried with backoff, and only the run's FINAL failure reaches
// onExtractionComplete, which marks the bill failed and deletes the image. So:
// throw freely, and don't delete the image on the error path — it must survive
// between attempts.
export const extractReceipt = internalAction({
  args: { billId: v.id('bills'), imageRef: v.string() },
  returns: v.null(),
  handler: async (ctx, { billId, imageRef }) => {
    const { bytes, mimeType } = await imageStore.readImage(ctx, imageRef)
    const parsed = await callVisionModel(bytes, mimeType)
    await ctx.runMutation(internal.bills.extraction.applyExtraction, {
      billId,
      imageRef,
      parsed,
    })
    // delete-after-extract (spec §10); best-effort — a throw here would retry
    // the whole (already applied) extraction for nothing.
    try {
      await imageStore.deleteImage(ctx, imageRef)
    } catch (error) {
      console.error('[privacy] failed to delete extracted receipt upload', {
        imageRef,
        error: error instanceof Error ? error.message : 'unknown error',
      })
    }
    return null
  },
})
