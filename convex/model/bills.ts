// Plain-TS bill helpers shared by the public mutations in convex/bills/*.
// No Convex functions are registered here — public wrappers stay thin and
// call into this module (see docs.convex.dev best practices).
import { ConvexError } from 'convex/values'
 import type { MutationCtx, QueryCtx } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { rateLimiter } from '../lib/rateLimits'
import type { Bill, Claim, LineItem, Person } from '../schema'
import { newClientId, nextPersonColor } from '../../src/lib/bill/ids'
import { MAX_NAME_LENGTH, MAX_PEOPLE } from '../../src/lib/bill/constants'

export function definedOnly<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, val]) => val !== undefined),
  )
}

export function now() {
  return Date.now()
}

export function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
}

export function cleanName(name: string) {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  if (!trimmed) throw new Error('Name is required')
  return trimmed
}

export function assertGuestSessionId(guestSessionId: string) {
  if (guestSessionId.trim().length < 8) {
    throw new Error('Invalid guest session')
  }
}

function assertUniqueIds(values: Array<{ id: string }>, label: string) {
  const seen = new Set<string>()
  for (const value of values) {
    if (!value.id) throw new Error(`${label} id is required`)
    if (seen.has(value.id)) throw new Error(`Duplicate ${label} id`)
    seen.add(value.id)
  }
}

export function validateLineItems(lineItems: LineItem[]) {
  assertUniqueIds(lineItems, 'line item')
  for (const item of lineItems) {
    if (!item.name.trim()) throw new Error('Line item name is required')
    assertFiniteNumber(item.qty, 'Line item quantity')
    assertFiniteNumber(item.unitPrice, 'Line item unit price')
    assertFiniteNumber(item.lineTotal, 'Line item total')
    if (item.qty <= 0) throw new Error('Line item quantity must be greater than 0')
    if (item.unitPrice < 0) throw new Error('Line item unit price cannot be negative')
    if (item.lineTotal < 0) throw new Error('Line item total cannot be negative')
    if (item.confidence !== undefined) {
      assertFiniteNumber(item.confidence, 'Line item confidence')
      if (item.confidence < 0 || item.confidence > 1) {
        throw new Error('Line item confidence must be between 0 and 1')
      }
    }
  }
}

export function validatePeople(people: Person[]) {
  assertUniqueIds(people, 'person')
  for (const p of people) {
    if (!p.name.trim()) throw new Error('Person name is required')
    if (!p.color.trim()) throw new Error('Person color is required')
  }
}

export function validateClaims(
  lineItems: LineItem[],
  people: Person[],
  claims: Claim[],
) {
  const itemIds = new Set(lineItems.map((i) => i.id))
  const personIds = new Set(people.map((p) => p.id))
  for (const c of claims) {
    if (!itemIds.has(c.itemId)) throw new Error('Claim references a missing item')
    if (!personIds.has(c.personId)) throw new Error('Claim references a missing person')
    assertFiniteNumber(c.units, 'Claim units')
    if (c.units < 0) throw new Error('Claim units cannot be negative')
  }
}

export async function getBillByShareToken(ctx: QueryCtx, shareToken: string) {
  const bill = await ctx.db
    .query('bills')
    .withIndex('by_share_token', (q) => q.eq('shareToken', shareToken))
    .unique()
  invariant(bill, 'bill not found')
  return bill
}

export function findGuestPerson(bill: Bill, guestSessionId: string) {
  return bill.people.find((p) => p.guestSessionId === guestSessionId) ?? null
}

export function createGuestPerson(
  bill: Bill,
  name: string,
  guestSessionId: string,
): Person {
  return {
    id: newClientId(),
    name,
    color: nextPersonColor(bill.people.length),
    guestSessionId,
  }
}

export function assertRoomForPerson(bill: Bill) {
  if (bill.people.length >= MAX_PEOPLE) {
    throw new ConvexError('This bill already has the maximum number of people')
  }
}

export async function limitGuestJoin(ctx: MutationCtx, billId: string) {
  const { ok } = await rateLimiter.limit(ctx, 'guestJoinPerBill', {
    key: billId,
  })
  if (!ok) {
    throw new ConvexError('Too many people joining at once — try again in a minute.')
  }
}

/** A guest may only touch a person row minted by their own session. */
export function assertOwnPerson(
  bill: Bill,
  personId: string,
  guestSessionId: string,
) {
  const person = bill.people.find((p) => p.id === personId)
  invariant(person, 'person not found')
  if (person.guestSessionId !== guestSessionId) {
    throw new Error('You can only edit your own claims')
  }
  return person
}

export function assertSharedForGuestWrites(bill: Bill) {
  if (bill.status === 'FINALIZED') {
    throw new Error('This split has been finalized')
  }
  if (bill.status !== 'PUBLISHED') {
    throw new Error('This split has not been shared yet')
  }
}

export function assertEditableSplit(bill: Bill) {
  if (bill.status === 'FINALIZED') {
    throw new Error('This split has been finalized')
  }
}

// Settling happens after sharing and — unlike claims — keeps working after
// FINALIZE. Gating to PUBLISHED|FINALIZED also closes a data-loss race:
// saveWorking ignores submitted people while PUBLISHED and no-ops while
// FINALIZED, so a stale review-editor flush can never wipe paidAt.
export function assertSettleOpen(bill: Bill) {
  if (bill.status !== 'PUBLISHED' && bill.status !== 'FINALIZED') {
    throw new Error('This split has not been shared yet')
  }
}

// On mark, keep an existing timestamp (idempotent under double-taps); on
// unmark, drop the key entirely — never store `undefined` in the array.
export function withPersonPaid(people: Person[], personId: string, paid: boolean) {
  return people.map((p) => {
    if (p.id !== personId) return p
    if (paid) return { ...p, paidAt: p.paidAt ?? now() }
    const { paidAt: _paidAt, ...rest } = p
    return rest
  })
}

// Claim writes are row diffs against the `claims` table (convex/model/
// claimRows.ts) and deliberately do NOT patch the bill document: no version
// bump, no full-document rewrite, no OCC contention between guests tapping at
// the same time. Subscribers still update live because getBill/getBillByToken
// read the rows.
export function saveClaimsForPerson(
  lineItems: LineItem[],
  currentClaims: Claim[],
  personId: string,
  claims: Array<{ itemId: string; units: number }>,
) {
  const itemById = new Map(lineItems.map((item) => [item.id, item]))
  const otherClaims = currentClaims.filter((c) => c.personId !== personId)
  const otherClaimedByItem = new Map<string, number>()
  for (const c of otherClaims) {
    otherClaimedByItem.set(
      c.itemId,
      (otherClaimedByItem.get(c.itemId) ?? 0) + c.units,
    )
  }

  const requestedByItem = new Map<string, number>()
  let rejectedCount = 0
  for (const c of claims) {
    const item = itemById.get(c.itemId)
    if (!item || !Number.isFinite(c.units) || c.units <= 0) {
      rejectedCount += 1
      continue
    }
    requestedByItem.set(
      c.itemId,
      (requestedByItem.get(c.itemId) ?? 0) + c.units,
    )
  }

  const acceptedClaims: Claim[] = []
  for (const [itemId, requestedUnits] of requestedByItem) {
    const item = itemById.get(itemId)
    if (!item) continue
    const available = Math.max(
      0,
      item.qty - (otherClaimedByItem.get(itemId) ?? 0),
    )
    const acceptedUnits = Math.min(requestedUnits, available)
    if (acceptedUnits < requestedUnits) rejectedCount += 1
    if (acceptedUnits > 0) {
      acceptedClaims.push({ itemId, personId, units: acceptedUnits })
    }
  }

  return {
    acceptedClaims,
    rejectedCount,
    nextClaims: [...otherClaims, ...acceptedClaims],
  }
}
