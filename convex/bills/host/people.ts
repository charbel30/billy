import { v } from 'convex/values'
import type { Person } from '../../schema'
import { claimRowsForBill } from '../../model/claimRows'
import { editableBillMutation, settleBillMutation } from '../lib/functions'
import {
  cleanName,
  assertRoomForPerson,
  now,
  renameHostOwnPerson,
  withPersonPaid,
} from '../../model/bills'
import { newClientId, nextPersonColor } from '../../../src/lib/bill/ids'

export const addHostPerson = editableBillMutation({
  args: { name: v.string() },
  returns: v.object({ personId: v.string() }),
  handler: async (ctx, { name }) => {
    const { bill } = ctx
    assertRoomForPerson(bill)
    const nextPerson: Person = {
      id: newClientId(),
      name: cleanName(name),
      color: nextPersonColor(bill.people.length),
    }
    await ctx.db.patch(bill._id, {
      people: [...bill.people, nextPerson],
      version: bill.version + 1,
      updatedAt: now(),
    })
    return { personId: nextPerson.id }
  },
})

// The host names their own person (seeded as 'self'). Scoped to that person:
// everyone else's name is theirs (guests) or set when added (host additions).
// The person keeps `isHost`, so protection and labels follow the rename.
export const renameHostPerson = editableBillMutation({
  args: { personId: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { personId, name }) => {
    const { bill } = ctx
    await ctx.db.patch(bill._id, {
      people: renameHostOwnPerson(bill, personId, name),
      version: bill.version + 1,
      updatedAt: now(),
    })
    return null
  },
})

export const removeHostPerson = editableBillMutation({
  args: { personId: v.string() },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const { bill } = ctx
    if (!bill.people.some((p) => p.id === personId)) {
      throw new Error('person not found')
    }
    if (bill.people.length <= 1) {
      throw new Error('At least one person is required')
    }
    await ctx.db.patch(bill._id, {
      people: bill.people.filter((p) => p.id !== personId),
      version: bill.version + 1,
      updatedAt: now(),
    })
    for (const row of await claimRowsForBill(ctx, bill._id)) {
      if (row.personId === personId) await ctx.db.delete(row._id)
    }
    return null
  },
})

// ---------------------------------------------------------------------------
// Mark-as-paid: who has actually paid. paidAt lives on the embedded people
// array (at most one write per person per bill).
// ---------------------------------------------------------------------------

export const setHostPersonPaid = settleBillMutation({
  args: {
    personId: v.string(),
    paid: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { personId, paid }) => {
    const { bill } = ctx
    if (!bill.people.some((p) => p.id === personId)) {
      throw new Error('person not found')
    }
    await ctx.db.patch(bill._id, {
      people: withPersonPaid(bill.people, personId, paid),
      version: bill.version + 1,
      updatedAt: now(),
    })
    return null
  },
})
