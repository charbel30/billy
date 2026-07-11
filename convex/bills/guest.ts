// Guest-side writes. The guestMutation builder (functions.ts) consumes
// (shareToken, guestSessionId), gates on PUBLISHED, and injects ctx.bill —
// guests can only join, add companions, and edit their own claims. Host
// writes live in lifecycle.ts / people.ts / hostClaims.ts.
import { v } from 'convex/values'
import { claim } from '../schema'
import { claimRowsForBill, syncClaimRows, toWireClaims } from './claimRows'
import { guestMutation } from './functions'
import { claimInputValidator } from './validators'
import {
  assertOwnPerson,
  assertRoomForPerson,
  cleanName,
  createGuestPerson,
  findGuestPerson,
  limitGuestJoin,
  now,
  saveClaimsForPerson,
} from '../model/bills'

export const joinSplit = guestMutation({
  args: { name: v.string() },
  returns: v.object({ personId: v.string() }),
  handler: async (ctx, { name }) => {
    const { bill, guestSessionId } = ctx
    const clean = cleanName(name)
    const existing = findGuestPerson(bill, guestSessionId)

    if (existing) {
      const nextPeople = bill.people.map((p) =>
        p.id === existing.id ? { ...p, name: clean } : p,
      )
      await ctx.db.patch(bill._id, {
        people: nextPeople,
        version: bill.version + 1,
        updatedAt: now(),
      })
      return { personId: existing.id }
    }

    assertRoomForPerson(bill)
    await limitGuestJoin(ctx, bill._id)
    const nextPerson = createGuestPerson(bill, clean, guestSessionId)
    await ctx.db.patch(bill._id, {
      people: [...bill.people, nextPerson],
      version: bill.version + 1,
      updatedAt: now(),
    })
    return { personId: nextPerson.id }
  },
})

export const addGuestPerson = guestMutation({
  args: { name: v.string() },
  returns: v.object({ personId: v.string() }),
  handler: async (ctx, { name }) => {
    const { bill, guestSessionId } = ctx
    assertRoomForPerson(bill)
    await limitGuestJoin(ctx, bill._id)
    const nextPerson = createGuestPerson(bill, cleanName(name), guestSessionId)
    await ctx.db.patch(bill._id, {
      people: [...bill.people, nextPerson],
      version: bill.version + 1,
      updatedAt: now(),
    })
    return { personId: nextPerson.id }
  },
})

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
