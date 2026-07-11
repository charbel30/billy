// Guest-side people writes. The guestMutation builder (../lib/functions.ts)
// consumes (shareToken, guestSessionId), gates on PUBLISHED, and injects
// ctx.bill — guests can only join and add companions. guestSettleMutation opens
// the same mark-as-paid window as the host side. Host writes live in
// ../host/people.ts.
import { v } from 'convex/values'
import { guestMutation, guestSettleMutation } from '../lib/functions'
import {
  assertOwnPerson,
  assertRoomForPerson,
  cleanName,
  createGuestPerson,
  findGuestPerson,
  limitGuestJoin,
  now,
  withPersonPaid,
} from '../../model/bills'

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

export const setGuestPersonPaid = guestSettleMutation({
  args: {
    personId: v.string(),
    paid: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { personId, paid }) => {
    const { bill } = ctx
    assertOwnPerson(bill, personId, ctx.guestSessionId)
    await ctx.db.patch(bill._id, {
      people: withPersonPaid(bill.people, personId, paid),
      version: bill.version + 1,
      updatedAt: now(),
    })
    return null
  },
})
