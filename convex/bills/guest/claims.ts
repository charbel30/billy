// Guest-side claim writes. The guestMutation builder (../lib/functions.ts)
// consumes (shareToken, guestSessionId), gates on PUBLISHED, and injects
// ctx.bill — guests can only edit their own claims. Host claim writes live in
// ../host/claims.ts.
import { v } from 'convex/values'
import { claim } from '../../schema'
import {
  claimRowsForBill,
  syncClaimRows,
  toWireClaims,
} from '../../model/claimRows'
import { guestMutation } from '../lib/functions'
import { claimInputValidator } from '../lib/validators'
import { assertOwnPerson, saveClaimsForPerson } from '../../model/bills'

export const saveGuestClaims = guestMutation({
  args: {
    personId: v.string(),
    claims: v.array(claimInputValidator),
  },
  returns: v.object({
    acceptedClaims: v.array(claim),
    rejectedCount: v.number(),
  }),
  handler: async (ctx, { personId, claims }) => {
    const { bill } = ctx
    assertOwnPerson(bill, personId, ctx.guestSessionId)

    const currentClaims = toWireClaims(await claimRowsForBill(ctx, bill._id))
    const result = saveClaimsForPerson(
      bill.lineItems,
      currentClaims,
      personId,
      claims,
    )
    await syncClaimRows(ctx, bill._id, result.nextClaims)

    return {
      acceptedClaims: result.acceptedClaims,
      rejectedCount: result.rejectedCount,
    }
  },
})
