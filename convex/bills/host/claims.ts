// Host-side claim writes. All of these are row diffs against the `claims`
// table — no bill patch, no version bump (see convex/model/bills.ts). The
// editableBillMutation builder resolves ctx.bill and gates on not-FINALIZED.
import { v } from 'convex/values'
import { stepPersonClaim } from '../../model/claimChanges'
import { invariant } from '../../lib/invariant'
import {
  claimRowsForBill,
  syncClaimRows,
  toWireClaims,
} from '../../model/claimRows'
import { editableBillMutation } from '../lib/functions'
import { itemShareResult, itemSplitSnapshot } from '../lib/validators'
import { restoreItemSplit, shareItemEvenly } from '../../model/itemSharing'

export const shareHostItemEvenly = editableBillMutation({
  args: {
    itemId: v.string(),
    personIds: v.array(v.string()),
    quantity: v.number(),
  },
  returns: itemShareResult,
  handler: async (ctx, { itemId, personIds, quantity }) =>
    shareItemEvenly(ctx, ctx.bill, itemId, personIds, quantity, new Set(ctx.bill.people.map((p) => p.id))),
})

export const restoreHostItemSplit = editableBillMutation({
  args: { itemId: v.string(), ...itemSplitSnapshot },
  returns: v.null(),
  handler: async (ctx, args) =>
    restoreItemSplit(ctx, ctx.bill, args, new Set(ctx.bill.people.map((p) => p.id))),
})

// End-of-split stall killer (roadmap Phase B): distribute every item's still-
// unclaimed units evenly across ALL people, ADDING on top of existing claims
// (shareHostItemEvenly adds only the chosen quantity for one item). Claims-only
// write — no bill patch, no version bump, same as the other claim mutations.
export const splitLeftoversEvenly = editableBillMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { bill } = ctx
    if (bill.people.length === 0) throw new Error('No people on the bill')

    const currentClaims = toWireClaims(await claimRowsForBill(ctx, bill._id))
    const byKey = new Map(
      currentClaims.map((c) => [`${c.itemId} ${c.personId}`, { ...c }]),
    )
    const claimedByItem = new Map<string, number>()
    for (const c of currentClaims) {
      claimedByItem.set(c.itemId, (claimedByItem.get(c.itemId) ?? 0) + c.units)
    }

    for (const item of bill.lineItems) {
      const remaining = item.qty - (claimedByItem.get(item.id) ?? 0)
      if (remaining <= 1e-6) continue
      const share = remaining / bill.people.length
      for (const p of bill.people) {
        const key = `${item.id} ${p.id}`
        const existing = byKey.get(key)
        if (existing) existing.units += share
        else byKey.set(key, { itemId: item.id, personId: p.id, units: share })
      }
    }

    await syncClaimRows(ctx, bill._id, [...byKey.values()])
    return null
  },
})

// Each tap carries intent; Convex applies it atomically to current claim rows.
export const stepHostClaim = editableBillMutation({
  args: {
    personId: v.string(),
    itemId: v.string(),
    delta: v.union(v.literal(1), v.literal(-1)),
  },
  returns: v.object({ rejectedCount: v.number() }),
  handler: async (ctx, { personId, itemId, delta }) => {
    const { bill } = ctx
    invariant(bill.people.some((p) => p.id === personId), 'person not found')
    const current = toWireClaims(await claimRowsForBill(ctx, bill._id))
    const result = stepPersonClaim(bill.lineItems, current, personId, itemId, delta)
    await syncClaimRows(ctx, bill._id, result.nextClaims)
    return { rejectedCount: result.rejectedCount }
  },
})
