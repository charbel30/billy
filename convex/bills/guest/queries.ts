import { claimRowsForBill, toWireClaims } from '../../model/claimRows'
import { sharedBillQuery } from '../lib/functions'
import { billDocValidator } from '../lib/validators'

// Claims live in their own table (see convex/schema.ts header), but the wire
// shape is still "one bill object": the query assembles { ...bill, claims }.
// Reading the claim rows here also subscribes the query to them, so claim
// writes push fresh results without ever touching the bill document.

export const getBillByToken = sharedBillQuery({
  args: {},
  returns: billDocValidator,
  handler: async (ctx) => {
    const { bill } = ctx
    return { ...bill, claims: toWireClaims(await claimRowsForBill(ctx, bill._id)) }
  },
})
