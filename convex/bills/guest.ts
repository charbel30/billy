// Guest-side writes, all scoped by (shareToken, guestSessionId). Guests can
// only join, add companions, and edit their own claims — host writes live in
// lifecycle.ts / people.ts / hostClaims.ts.
import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { claim } from '../schema'
import { claimRowsForBill, syncClaimRows, toWireClaims } from './claimRows'
import { claimInputValidator } from './validators'
import {
  assertGuestSessionId,
  assertRoomForPerson,
  assertSharedForGuestWrites,
  cleanName,
  createGuestPerson,
  findGuestPerson,
  getBillByShareToken,
  limitGuestJoin,
  now,
  saveClaimsForPerson,
} from '../model/bills'

export const joinSplit = mutation({
  args: {
    shareToken: v.string(),
    guestSessionId: v.string(),
    name: v.string(),
  },
  returns: v.object({ personId: v.string() }),
  handler: async (ctx, { shareToken, guestSessionId, name }) => {
    assertGuestSessionId(guestSessionId)
    const bill = await getBillByShareToken(ctx, shareToken)
    assertSharedForGuestWrites(bill)
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

export const addGuestPerson = mutation({
  args: {
    shareToken: v.string(),
    guestSessionId: v.string(),
    name: v.string(),
  },
  returns: v.object({ personId: v.string() }),
  handler: async (ctx, { shareToken, guestSessionId, name }) => {
    assertGuestSessionId(guestSessionId)
    const bill = await getBillByShareToken(ctx, shareToken)
    assertSharedForGuestWrites(bill)
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

export const saveGuestClaims = mutation({
  args: {
    shareToken: v.string(),
    guestSessionId: v.string(),
    personId: v.string(),
    claims: v.array(claimInputValidator),
  },
  returns: v.object({
    acceptedClaims: v.array(claim),
    rejectedCount: v.number(),
  }),
  handler: async (ctx, { shareToken, guestSessionId, personId, claims }) => {
    assertGuestSessionId(guestSessionId)
    const bill = await getBillByShareToken(ctx, shareToken)
    assertSharedForGuestWrites(bill)
    const person = bill.people.find((p) => p.id === personId)
    invariant(person, 'person not found')
    if (person.guestSessionId !== guestSessionId) {
      throw new Error('You can only edit your own claims')
    }

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
