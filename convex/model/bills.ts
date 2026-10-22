import { lineItemsError } from '../../src/lib/bill/validation'
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
import {
  hostPersonId,
  isReservedGuestName,
} from '../../src/lib/bill/hostPerson'

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

/** cleanName for guest-chosen names (joinSplit / addGuestPerson): the host's
 * seed name and the "Host" label guests see for it are reserved. */
export function cleanGuestName(name: string) {
  const clean = cleanName(name)
  if (isReservedGuestName(clean)) {
    throw new ConvexError('That name is reserved for the host — pick another name.')
  }
  return clean
}

export function assertGuestSessionId(guestSessionId: string) {
  if (!guestSessionId.startsWith('v2:') || guestSessionId.length < 20) {
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
  const error = lineItemsError(lineItems)
  if (error) throw new ConvexError(error)
}

export function validatePeople(people: Person[]) {
  if (people.length > MAX_PEOPLE)
    throw new ConvexError('Too many people on this bill')
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
    if (!itemIds.has(c.itemId))
      throw new Error('Claim references a missing item')
    if (!personIds.has(c.personId))
      throw new Error('Claim references a missing person')
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

// ---------------------------------------------------------------------------
// Host capability. `bills.hostToken` is a bearer secret minted server-side on
// create and held only on the host's device — the bill id (which is in the URL)
// authorizes nothing on its own. Applied by the builders in
// convex/bills/lib/functions.ts, never inline in a handler.
// ---------------------------------------------------------------------------

/** Length-safe compare with no early exit on the first differing character.
 *  The stored token's length is a fixed public constant, so the only
 *  input-dependent work is over the caller's own string. */
function secretEquals(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export function assertHostToken(bill: Bill, hostToken: string) {
  if (!secretEquals(bill.hostToken, hostToken)) {
    // ConvexError so the message survives prod error redaction: a host opening
    // their own bill on a second device needs to understand why it's read-only.
    throw new ConvexError(
      "This device doesn't have edit access to this bill — open it on the device that scanned it.",
    )
  }
}

/** Every bill query includes claim rows and strips all host/guest edit credentials. */
export function toWireBill<T extends Bill>(bill: T, claims: Claim[]) {
  const {
    hostToken: _hostToken,
    extractionBaseVersion: _baseVersion,
    people,
    ...rest
  } = bill
  return {
    ...rest,
    people: people.map(
      ({ guestSessionId: _secret, guestAccessVersion: _version, ...person }) =>
        person,
    ),
    claims,
    guestAccessReset: people.some(
      (p) => p.guestSessionId && p.guestAccessVersion !== 2,
    ),
  }
}

export function findGuestPerson(bill: Bill, guestSessionId: string) {
  return (
    bill.people.find(
      (p) => p.guestAccessVersion === 2 && p.guestSessionId === guestSessionId,
    ) ?? null
  )
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
    guestAccessVersion: 2,
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
    throw new ConvexError(
      'Too many people joining at once — try again in a minute.',
    )
  }
}

/** Person-scoped guest writes (e.g. mark-as-paid): only a person row minted
 * by the caller's own session. Claim writes use assertSessionAtTable instead. */
export function assertOwnPerson(
  bill: Bill,
  personId: string,
  guestSessionId: string,
) {
  const person = bill.people.find((p) => p.id === personId)
  invariant(person, 'person not found')
  if (
    person.guestAccessVersion !== 2 ||
    person.guestSessionId !== guestSessionId
  ) {
    throw new Error('You can only change your own people')
  }
  return person
}

/**
 * Id of the host's own person: the one seeded with `isHost: true` at bill
 * creation (legacy bills: the DEFAULT_PERSON_NAME seed), and NEVER a row that
 * carries a guest session — guest-minted people always do, and no guest
 * mutation can set `isHost` or take the seed name (cleanGuestName).
 */
export function hostOwnPersonId(bill: Pick<Bill, 'people'>) {
  const id = hostPersonId(bill.people)
  const person = bill.people.find((p) => p.id === id)
  return person && !person.guestSessionId ? person.id : undefined
}

/**
 * People from a host editor payload (saveWorking), reduced to the fields an
 * editor may set (id/name/color). Everything else comes from the STORED
 * person with the same id: guest ownership credentials, paid state, and the
 * host marker — `isHost` is stamped on the stored host's own person only (this
 * also pins the legacy name fallback), so a payload can neither set, clear nor
 * move it. The host's own name is likewise kept as stored: renameHostPerson
 * owns it, so a stale editor copy can never quietly revert a rename.
 */
export function editorPeople(bill: Bill, people: Person[]): Person[] {
  const hostId = hostOwnPersonId(bill)
  const stored = new Map(bill.people.map((p) => [p.id, p]))
  return people.map((person) => {
    const existing = stored.get(person.id)
    const isHost = hostId !== undefined && person.id === hostId
    return {
      id: person.id,
      name: isHost && existing ? existing.name : person.name,
      color: person.color,
      ...(existing?.guestSessionId
        ? { guestSessionId: existing.guestSessionId }
        : {}),
      ...(existing?.guestAccessVersion
        ? { guestAccessVersion: existing.guestAccessVersion }
        : {}),
      ...(existing?.paidAt != null ? { paidAt: existing.paidAt } : {}),
      ...(isHost ? { isHost: true } : {}),
    }
  })
}

/** renameHostPerson: only the host's own person, under the usual name rules.
 * Pins `isHost` on it, so a renamed legacy seed stays recognised. */
export function renameHostOwnPerson(bill: Bill, personId: string, name: string) {
  const hostId = hostOwnPersonId(bill)
  if (!hostId || personId !== hostId) {
    invariant(bill.people.some((p) => p.id === personId), 'person not found')
    throw new ConvexError('Only your own name can be changed here')
  }
  const clean = cleanName(name)
  return bill.people.map((p) =>
    p.id === hostId ? { ...p, name: clean, isHost: true } : p,
  )
}

/**
 * Guest claim writes: the calling session must control at least one person
 * currently on the bill (i.e. it has joined the table). Holding the share link
 * alone is not enough. Once at the table, a guest may:
 *   - claimIds: step/claim for anyone EXCEPT the host's own person;
 *   - shareIds: include anyone, the host's person too, in an even split (and
 *     undo it) — see assertGuestShareTargets.
 */
export function assertSessionAtTable(bill: Bill, guestSessionId: string) {
  const atTable = bill.people.some(
    (p) => p.guestAccessVersion === 2 && p.guestSessionId === guestSessionId,
  )
  if (!atTable) {
    throw new ConvexError('Join the table before claiming items')
  }
  const hostId = hostOwnPersonId(bill)
  return {
    claimIds: new Set(
      bill.people.filter((p) => p.id !== hostId).map((p) => p.id),
    ),
    shareIds: new Set(bill.people.map((p) => p.id)),
  }
}

const HOST_ONLY_MESSAGE = 'Only the host can change their own items'

/** Guest step target: someone at the table other than the host's own person. */
export function assertGuestClaimTarget(
  bill: Bill,
  claimIds: ReadonlySet<string>,
  personId: string,
) {
  if (claimIds.has(personId)) return
  invariant(bill.people.some((p) => p.id === personId), 'person not found')
  throw new ConvexError(HOST_ONLY_MESSAGE)
}

/** A guest may put the host's person into an even split only alongside someone
 * else — sharing with the host alone would be claiming for them. */
export function assertGuestShareTargets(bill: Bill, personIds: string[]) {
  const ids = new Set(personIds)
  const hostId = hostOwnPersonId(bill)
  const includesHost = hostId !== undefined && ids.has(hostId)
  if (includesHost && ids.size < 2) throw new ConvexError(HOST_ONLY_MESSAGE)
}

export function assertSharedForGuestWrites(bill: Bill) {
  if (bill.status === 'FINALIZED') {
    throw new Error('This split has been finalized')
  }
  if (bill.status !== 'PUBLISHED') {
    throw new Error('This split has not been shared yet')
  }
}

// A shared bill's items are already in other people's hands: replacing them
// with a fresh scan (or dropping a scan that is mid-flight) would rewrite what
// guests are looking at. Revoke first, or start a new bill.
export function assertScanOpen(bill: Bill) {
  if (bill.status === 'PUBLISHED' || bill.status === 'FINALIZED') {
    throw new ConvexError(
      'Revoke sharing before scanning again. Finalized receipts cannot be rescanned.',
    )
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
export function withPersonPaid(
  people: Person[],
  personId: string,
  paid: boolean,
) {
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
