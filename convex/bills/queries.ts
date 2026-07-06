import { v } from 'convex/values'
import { query } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { claimRowsForBill, toWireClaims } from './claimRows'
import { billDocValidator } from './validators'

// Claims live in their own table (see convex/schema.ts header), but the wire
// shape is still "one bill object": both queries assemble { ...bill, claims }.
// Reading the claim rows here also subscribes the query to them, so claim
// writes push fresh results without ever touching the bill document.

export const getBill = query({
  args: { id: v.id('bills') },
  returns: billDocValidator,
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    return { ...bill, claims: toWireClaims(await claimRowsForBill(ctx, id)) }
  },
})

export const getBillByToken = query({
  args: { shareToken: v.string() },
  returns: billDocValidator,
  handler: async (ctx, { shareToken }) => {
    const bill = await ctx.db
      .query('bills')
      .withIndex('by_share_token', (q) => q.eq('shareToken', shareToken))
      .unique()
    invariant(bill, 'bill not found')
    return {
      ...bill,
      claims: toWireClaims(await claimRowsForBill(ctx, bill._id)),
    }
  },
})
