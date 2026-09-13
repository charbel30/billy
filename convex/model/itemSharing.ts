import { ConvexError } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { Claim } from '../schema'
import { remainingUnits } from '../../src/lib/money/split'
import { claimRowsForBill, syncClaimRows, toWireClaims } from './claimRows'

export async function shareItemEvenly(
  ctx: MutationCtx,
  bill: Doc<'bills'>,
  itemId: string,
  personIds: string[],
  quantity: number,
  editableIds: ReadonlySet<string>,
) {
  const item = bill.lineItems.find((item) => item.id === itemId)
  if (!item) throw new ConvexError('Item no longer exists')
  const ids = [...new Set(personIds)]
  if (!ids.length) throw new ConvexError('Choose at least one person')
  if (ids.some((id) => !editableIds.has(id))) throw new ConvexError('You cannot edit that person')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ConvexError('Choose a positive number of orders')
  const current = toWireClaims(await claimRowsForBill(ctx, bill._id))
  const before = current.filter((c) => c.itemId === itemId)
  const available = remainingUnits(item, current)
  // Check current capacity atomically. Never silently change the chosen quantity
  // or take back an existing whole order or share, including a recipient's own.
  if (available <= 0 || quantity > available + 1e-8) {
    throw new ConvexError('There are fewer orders left now. Check the quantity and try again.')
  }
  const units = Math.min(quantity, available) / ids.length
  const byPerson = new Map(before.map((claim) => [claim.personId, { ...claim }]))
  for (const personId of ids) {
    const existing = byPerson.get(personId)
    byPerson.set(personId, { itemId, personId, units: (existing?.units ?? 0) + units })
  }
  const after = [...byPerson.values()]
  await syncClaimRows(ctx, bill._id, [...current.filter((c) => c.itemId !== itemId), ...after])
  return { before, after, qty: item.qty }
}

function sameClaims(a: Claim[], b: Claim[]) {
  const byPerson = new Map(a.map((c) => [c.personId, c.units]))
  return a.length === b.length && byPerson.size === a.length &&
    new Set(b.map((c) => c.personId)).size === b.length &&
    b.every((c) => byPerson.get(c.personId) === c.units)
}

/** Undo only this item, only if the saved result is still current. */
export async function restoreItemSplit(
  ctx: MutationCtx,
  bill: Doc<'bills'>,
  args: { itemId: string; before: Claim[]; after: Claim[]; qty: number },
  editableIds: ReadonlySet<string>,
) {
  const { itemId, before, after, qty } = args
  const item = bill.lineItems.find((item) => item.id === itemId)
  const people = new Set(bill.people.map((p) => p.id))
  if (!item || item.qty !== qty) throw new ConvexError('The item changed. Check its current claims.')
  if ([...before, ...after].some((c) => c.itemId !== itemId || !people.has(c.personId) || !Number.isFinite(c.units) || c.units <= 0) ||
    new Set(before.map((c) => c.personId)).size !== before.length ||
    before.reduce((sum, c) => sum + c.units, 0) > item.qty + 1e-8) {
    throw new ConvexError('This split can no longer be restored')
  }
  const current = toWireClaims(await claimRowsForBill(ctx, bill._id))
  const currentItem = current.filter((c) => c.itemId === itemId)
  if (!sameClaims(currentItem, after)) throw new ConvexError('The split changed since you saved it. Check its current claims.')
  if (!sameClaims(currentItem.filter((c) => !editableIds.has(c.personId)), before.filter((c) => !editableIds.has(c.personId)))) {
    throw new ConvexError('You cannot edit another person’s share')
  }
  await syncClaimRows(ctx, bill._id, [...current.filter((c) => c.itemId !== itemId), ...before])
  return null
}
