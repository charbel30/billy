import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { invariant } from '../lib/invariant'
import * as imageStore from '../lib/imageStore'

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await imageStore.createUploadTarget(ctx),
})

export const attachImageAndExtract = mutation({
  args: { billId: v.id('bills'), imageRef: v.string() },
  returns: v.null(),
  handler: async (ctx, { billId, imageRef }) => {
    const bill = await ctx.db.get(billId)
    invariant(bill, `missing bill ${billId}`)
    await ctx.db.patch(billId, { imageRef })
    await ctx.scheduler.runAfter(0, internal.extraction.actions.extractReceipt, {
      billId,
      imageRef,
    })
    return null
  },
})
