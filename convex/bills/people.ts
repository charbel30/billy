import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { invariant } from '../lib/invariant'
import type { Person } from '../schema'
import { claimRowsForBill } from './claimRows'
import {
  assertEditableSplit,
  assertGuestSessionId,
  assertRoomForPerson,
  assertSettleOpen,
  cleanName,
  getBillByShareToken,
  now,
  withPersonPaid,
} from '../model/bills'
import { newClientId, nextPersonColor } from '../../src/lib/bill/ids'

export const addHostPerson = mutation({
  args: {
    id: v.id('bills'),
    name: v.string(),
  },
  returns: v.object({ personId: v.string() }),
  handler: async (ctx, { id, name }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertEditableSplit(bill)
    assertRoomForPerson(bill)
    const nextPerson: Person = {
      id: newClientId(),
      name: cleanName(name),
      color: nextPersonColor(bill.people.length),
    }
    await ctx.db.patch(id, {
      people: [...bill.people, nextPerson],
      version: bill.version + 1,
      updatedAt: now(),
    })
    return { personId: nextPerson.id }
  },
})

export const removeHostPerson = mutation({
  args: {
    id: v.id('bills'),
    personId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { id, personId }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertEditableSplit(bill)
    if (!bill.people.some((p) => p.id === personId)) {
      throw new Error('person not found')
    }
    if (bill.people.length <= 1) {
      throw new Error('At least one person is required')
    }
    await ctx.db.patch(id, {
      people: bill.people.filter((p) => p.id !== personId),
      version: bill.version + 1,
      updatedAt: now(),
    })
    for (const row of await claimRowsForBill(ctx, id)) {
      if (row.personId === personId) await ctx.db.delete(row._id)
    }
    return null
  },
})

// ---------------------------------------------------------------------------
// Mark-as-paid: who has actually paid. paidAt lives on the embedded people
// array (at most one write per person per bill).
// ---------------------------------------------------------------------------

export const setHostPersonPaid = mutation({
  args: {
    id: v.id('bills'),
    personId: v.string(),
    paid: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { id, personId, paid }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertSettleOpen(bill)
    if (!bill.people.some((p) => p.id === personId)) {
      throw new Error('person not found')
    }
    await ctx.db.patch(id, {
      people: withPersonPaid(bill.people, personId, paid),
      version: bill.version + 1,
      updatedAt: now(),
    })
    return null
  },
})

export const setGuestPersonPaid = mutation({
  args: {
    shareToken: v.string(),
    guestSessionId: v.string(),
    personId: v.string(),
    paid: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { shareToken, guestSessionId, personId, paid }) => {
    assertGuestSessionId(guestSessionId)
    const bill = await getBillByShareToken(ctx, shareToken)
    assertSettleOpen(bill)
    const person = bill.people.find((p) => p.id === personId)
    invariant(person, 'person not found')
    if (person.guestSessionId !== guestSessionId) {
      throw new Error('You can only edit your own claims')
    }
    await ctx.db.patch(bill._id, {
      people: withPersonPaid(bill.people, personId, paid),
      version: bill.version + 1,
      updatedAt: now(),
    })
    return null
  },
})
