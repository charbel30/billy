// Guest-side claim writes. The guestMutation builder (../lib/functions.ts)
// consumes (shareToken, guestSessionId), gates on PUBLISHED, and injects
// ctx.bill — guests can only edit their own claims. Host claim writes live in
// ../host/claims.ts.
import { v } from 'convex/values'
import { stepPersonClaim } from '../../model/claimChanges'
import {
  claimRowsForBill,
  syncClaimRows,
  toWireClaims,
} from '../../model/claimRows'
import { guestMutation } from '../lib/functions'
import { assertOwnPerson } from '../../model/bills'

// Each tap carries intent; Convex applies it atomically to current claim rows.
export const stepGuestClaim = guestMutation({
  args: {
    personId: v.string(),
    itemId: v.string(),
    delta: v.union(v.literal(1), v.literal(-1)),
  },
  returns: v.object({ rejectedCount: v.number() }),
  handler: async (ctx, { personId, itemId, delta }) => {
    const { bill } = ctx
    assertOwnPerson(bill, personId, ctx.guestSessionId)
    const current = toWireClaims(await claimRowsForBill(ctx, bill._id))
    const result = stepPersonClaim(bill.lineItems, current, personId, itemId, delta)
    await syncClaimRows(ctx, bill._id, result.nextClaims)
    return { rejectedCount: result.rejectedCount }
  },
})

// Share only the selected owned people, preserving everyone else's claims.
export const shareGuestItemEvenly = guestMutation({
  args: { itemId: v.string(), personIds: v.array(v.string()) },
  returns: v.object({ rejectedCount: v.number() }),
  handler: async (ctx, { itemId, personIds }) => {
    const { bill } = ctx
    const ids = new Set(personIds)
    if (ids.size === 0) throw new Error('Choose at least one person')
    for (const id of ids) assertOwnPerson(bill, id, ctx.guestSessionId)
    const item = bill.lineItems.find((item) => item.id === itemId)
    if (!item) throw new Error('Item no longer exists')
    const current = toWireClaims(await claimRowsForBill(ctx, bill._id))
    const preserved = current.filter(
      (c) => c.itemId !== itemId || !ids.has(c.personId),
    )
    const taken = preserved
      .filter((c) => c.itemId === itemId)
      .reduce((sum, c) => sum + c.units, 0)
    const units = Math.max(0, item.qty - taken) / ids.size
    await syncClaimRows(ctx, bill._id, [
      ...preserved,
      ...(units > 0 ? [...ids].map((personId) => ({ itemId, personId, units })) : []),
    ])
    return { rejectedCount: taken > 0 ? 1 : 0 }
  },
})
