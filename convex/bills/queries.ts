import { v } from 'convex/values'
import { query } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { billDocValidator } from './validators'

export const getBill = query({
  args: { id: v.id('bills') },
  returns: billDocValidator,
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    return bill
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
    return bill
  },
})
