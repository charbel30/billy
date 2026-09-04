import { claimRowsForBill, toWireClaims } from '../../model/claimRows'
import { toWireBill } from '../../model/bills'
import { sharedBillQuery } from '../lib/functions'
import { billDocValidator } from '../lib/validators'

// Claims live in their own table (see convex/schema.ts header), but the wire
// shape is still "one bill object": the query assembles { ...bill, claims }.
// Reading the claim rows here also subscribes the query to them, so claim
// writes push fresh results without ever touching the bill document.
// toWireBill strips `hostToken`: anyone with the share link reads this, so the
// host's capability must not ride along in it.

export const getBillByToken = sharedBillQuery({
  args: {},
  returns: billDocValidator,
  handler: async (ctx) => {
    const { bill } = ctx
    return toWireBill(bill, toWireClaims(await claimRowsForBill(ctx, bill._id)))
  },
})
