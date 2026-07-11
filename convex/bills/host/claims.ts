// Host-side claim writes. All of these are row diffs against the `claims`
// table — no bill patch, no version bump (see convex/model/bills.ts). The
// editableBillMutation builder resolves ctx.bill and gates on not-FINALIZED.
import { v } from 'convex/values'
import { invariant } from '../../lib/invariant'
import { claim } from '../../schema'
import {
  claimRowsForBill,
  syncClaimRows,
  toWireClaims,
} from '../../model/claimRows'
import { editableBillMutation } from '../lib/functions'
import { claimInputValidator } from '../lib/validators'
import { saveClaimsForPerson } from '../../model/bills'

export const saveHostClaims = editableBillMutation({
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
    const person = bill.people.find((p) => p.id === personId)
    invariant(person, 'person not found')

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

export const shareHostItemEvenly = editableBillMutation({
  args: {
    itemId: v.string(),
    personIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, personIds }) => {
    const { bill } = ctx
    const item = bill.lineItems.find((li) => li.id === itemId)
    invariant(item, 'item not found')
    if (personIds.length === 0) throw new Error('Choose at least one person')
    const peopleIds = new Set(bill.people.map((p) => p.id))
    for (const personId of personIds) {
      if (!peopleIds.has(personId)) throw new Error('person not found')
    }

    const units = item.qty / personIds.length
    const currentClaims = toWireClaims(await claimRowsForBill(ctx, bill._id))
    await syncClaimRows(ctx, bill._id, [
      ...currentClaims.filter((c) => c.itemId !== itemId),
      ...personIds.map((personId) => ({ itemId, personId, units })),
    ])
    return null
  },
})

// End-of-split stall killer (roadmap Phase B): distribute every item's still-
// unclaimed units evenly across ALL people, ADDING on top of existing claims
// (unlike shareHostItemEvenly, which replaces an item's claims). Claims-only
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
