import { claimRowsForBill, toWireClaims } from './claimRows'
import { billQuery, sharedBillQuery } from './functions'
import { billDocValidator } from './validators'

// Claims live in their own table (see convex/schema.ts header), but the wire
// shape is still "one bill object": both queries assemble { ...bill, claims }.
// Reading the claim rows here also subscribes the query to them, so claim
// writes push fresh results without ever touching the bill document.

export const getBill = billQuery({
  args: {},
  returns: billDocValidator,
  handler: async (ctx) => {
    const { bill } = ctx
    return { ...bill, claims: toWireClaims(await claimRowsForBill(ctx, bill._id)) }
  },
})

export const getBillByToken = sharedBillQuery({
  args: {},
  returns: billDocValidator,
  handler: async (ctx) => {
    const { bill } = ctx
    return { ...bill, claims: toWireClaims(await claimRowsForBill(ctx, bill._id)) }
  },
})
