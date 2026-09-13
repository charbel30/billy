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
import { itemShareResult, itemSplitSnapshot } from '../lib/validators'
import { restoreItemSplit, shareItemEvenly } from '../../model/itemSharing'
import type { Doc } from '../../_generated/dataModel'

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

function editablePeople(bill: Doc<'bills'>, sessionId: string) {
  return new Set(bill.people.filter((p) => p.guestAccessVersion === 2 && p.guestSessionId === sessionId).map((p) => p.id))
}

// Add the chosen unclaimed quantity to selected people in this session.
export const shareGuestItemEvenly = guestMutation({
  args: { itemId: v.string(), personIds: v.array(v.string()), quantity: v.number() },
  returns: itemShareResult,
  handler: async (ctx, { itemId, personIds, quantity }) =>
    shareItemEvenly(ctx, ctx.bill, itemId, personIds, quantity, editablePeople(ctx.bill, ctx.guestSessionId)),
})

export const restoreGuestItemSplit = guestMutation({
  args: { itemId: v.string(), ...itemSplitSnapshot },
  returns: v.null(),
  handler: async (ctx, args) =>
    restoreItemSplit(ctx, ctx.bill, args, editablePeople(ctx.bill, ctx.guestSessionId)),
})
