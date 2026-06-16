import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { internal } from '../_generated/api'
import * as imageStore from '../lib/imageStore'
import { callVisionModel } from './vision'

export const extractReceipt = internalAction({
  args: { billId: v.id('bills'), imageRef: v.string() },
  returns: v.null(),
  handler: async (ctx, { billId, imageRef }) => {
    const { bytes, mimeType } = await imageStore.readImage(ctx, imageRef)
    const parsed = await callVisionModel(bytes, mimeType)
    await ctx.runMutation(internal.bills.extraction.applyExtraction, {
      billId,
      parsed,
    })
    // delete-after-extract (spec §10); best-effort.
    try {
      await imageStore.deleteImage(ctx, imageRef)
    } catch {
      // Already gone or not deletable.
    }
    return null
  },
})
