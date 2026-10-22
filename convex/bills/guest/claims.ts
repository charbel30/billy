// Guest-side claim writes. The guestClaimMutation builder (../lib/functions.ts)
// consumes (shareToken, guestSessionId), gates on PUBLISHED, requires the
// session to have joined the table, rate limits per session and per bill, and
// injects ctx.bill + ctx.claimIds/ctx.shareIds. A guest whose session has
// joined the table (controls at least one person on the bill) may claim and
// unclaim for anyone at the table except the host's own person, and may split
// items (and undo the split) with anyone, the host's person included; a link
// holder who never joined may not write claims at all. Host claim writes live
// in ../host/claims.ts.
import { v } from 'convex/values'
import { stepPersonClaim } from '../../model/claimChanges'
import {
  claimRowsForBill,
  syncClaimRows,
  toWireClaims,
} from '../../model/claimRows'
import { guestClaimMutation } from '../lib/functions'
import { itemShareResult, itemSplitSnapshot } from '../lib/validators'
import { restoreItemSplit, shareItemEvenly } from '../../model/itemSharing'
import {
  assertGuestClaimTarget,
  assertGuestShareTargets,
} from '../../model/bills'

// Each tap carries intent; Convex applies it atomically to current claim rows.
export const stepGuestClaim = guestClaimMutation({
  args: {
    personId: v.string(),
    itemId: v.string(),
    delta: v.union(v.literal(1), v.literal(-1)),
  },
  returns: v.object({ rejectedCount: v.number() }),
  handler: async (ctx, { personId, itemId, delta }) => {
    const { bill, claimIds } = ctx
    assertGuestClaimTarget(bill, claimIds, personId)
    const current = toWireClaims(await claimRowsForBill(ctx, bill._id))
    const result = stepPersonClaim(bill.lineItems, current, personId, itemId, delta)
    await syncClaimRows(ctx, bill._id, result.nextClaims)
    return { rejectedCount: result.rejectedCount }
  },
})

// Add the chosen unclaimed quantity to the selected people at the table. The
// host's person may be included, but only alongside someone else.
export const shareGuestItemEvenly = guestClaimMutation({
  args: { itemId: v.string(), personIds: v.array(v.string()), quantity: v.number() },
  returns: itemShareResult,
  handler: async (ctx, { itemId, personIds, quantity }) => {
    assertGuestShareTargets(ctx.bill, personIds)
    return shareItemEvenly(ctx, ctx.bill, itemId, personIds, quantity, ctx.shareIds)
  },
})

export const restoreGuestItemSplit = guestClaimMutation({
  args: { itemId: v.string(), ...itemSplitSnapshot },
  returns: v.null(),
  handler: async (ctx, args) =>
    restoreItemSplit(ctx, ctx.bill, args, ctx.shareIds),
})
