import { ConvexError, v } from 'convex/values'
import { mutation, type MutationCtx } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { rateLimiter } from '../lib/rateLimits'
import { claim, lineItem, person, type Bill, type Claim, type LineItem, type Person } from '../schema'
import { claimRowsForBill, syncClaimRows, toWireClaims } from './claimRows'
import { metaValidator } from './validators'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import { DEFAULT_PERSON_NAME } from '../../src/lib/bill/constants'
import { newClientId, newShareToken, nextPersonColor } from '../../src/lib/bill/ids'
import { reconcileClaims } from '../../src/lib/bill/edits'

const MAX_NAME_LENGTH = 48
// Hard ceiling on participants — a leaked share link must not let strangers
// spam a bill with unlimited "people" (the rate limiter slows it, this stops it).
const MAX_PEOPLE = 30

const guestClaimInput = v.object({
  itemId: v.string(),
  units: v.number(),
})

function definedOnly<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, val]) => val !== undefined),
  )
}

function now() {
  return Date.now()
}

function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
}

function cleanName(name: string) {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  if (!trimmed) throw new Error('Name is required')
  return trimmed
}

function assertGuestSessionId(guestSessionId: string) {
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

function validateLineItems(lineItems: LineItem[]) {
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

function validatePeople(people: Person[]) {
  assertUniqueIds(people, 'person')
  for (const p of people) {
    if (!p.name.trim()) throw new Error('Person name is required')
    if (!p.color.trim()) throw new Error('Person color is required')
  }
}

function validateClaims(
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

async function getBillByShareToken(ctx: MutationCtx, shareToken: string) {
  const bill = await ctx.db
    .query('bills')
    .withIndex('by_share_token', (q) => q.eq('shareToken', shareToken))
    .unique()
  invariant(bill, 'bill not found')
  return bill
}

function findGuestPerson(bill: Bill, guestSessionId: string) {
  return bill.people.find((p) => p.guestSessionId === guestSessionId) ?? null
}

function createGuestPerson(
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

function assertRoomForPerson(bill: Bill) {
  if (bill.people.length >= MAX_PEOPLE) {
    throw new ConvexError('This bill already has the maximum number of people')
  }
}

async function limitGuestJoin(ctx: MutationCtx, billId: string) {
  const { ok } = await rateLimiter.limit(ctx, 'guestJoinPerBill', {
    key: billId,
  })
  if (!ok) {
    throw new ConvexError('Too many people joining at once — try again in a minute.')
  }
}

function assertSharedForGuestWrites(bill: Bill) {
  if (bill.status === 'FINALIZED') {
    throw new Error('This split has been finalized')
  }
  if (bill.status !== 'PUBLISHED') {
    throw new Error('This split has not been shared yet')
  }
}

function assertEditableSplit(bill: Bill) {
  if (bill.status === 'FINALIZED') {
    throw new Error('This split has been finalized')
  }
}

// Claim writes are row diffs against the `claims` table (convex/bills/
// claimRows.ts) and deliberately do NOT patch the bill document: no version
// bump, no full-document rewrite, no OCC contention between guests tapping at
// the same time. Subscribers still update live because getBill/getBillByToken
// read the rows.
function saveClaimsForPerson(
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

export const createBill = mutation({
  args: {
    merchantName: v.optional(v.string()),
    currencyPrimary: v.optional(v.string()),
    deviceId: v.string(),
  },
  returns: v.id('bills'),
  handler: async (ctx, args) => {
    if (args.deviceId.trim().length < 8) {
      throw new ConvexError('Invalid device id')
    }
    const { ok } = await rateLimiter.limit(ctx, 'createBillPerDevice', {
      key: args.deviceId,
    })
    if (!ok) {
      throw new ConvexError('Too many new bills from this device — try again in a bit.')
    }
    return await ctx.db.insert('bills', {
      merchantName: args.merchantName ?? '',
      currencyPrimary: args.currencyPrimary ?? 'LBP',
      rate: DEFAULT_RATE,
      // Manual by default: rate is a 90000 knob, not driven by printed totals.
      // Extraction may later upgrade this to 'receipt' if the paper prints both
      // currency totals (see saveWorking's deriveRate fallback).
      rateSource: 'manual',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
      shareToken: newShareToken(),
      status: 'PENDING',
      version: 0,
      updatedAt: now(),
      lineItems: [],
      people: [
        {
          id: newClientId(),
          name: DEFAULT_PERSON_NAME,
          color: nextPersonColor(0),
        },
      ],
    })
  },
})

// The Maison Zola receipt from the build spec (appendix A): items reconcile
// exactly to 19,440,000 LL / $216 at the receipt's own 90,000 rate. Lets the
// landing page and in-person pitches demo the full flow with zero camera,
// zero network luck, and zero Gemini spend.
const DEMO_LINES: Array<[name: string, qty: number, lineTotalLbp: number]> = [
  ['Captain Morgan White', 1, 1_260_000],
  ['Chivas 12Y Glass', 5, 6_300_000],
  ['Almaza – 33cl', 1, 540_000],
  ['Water Btl Small', 3, 810_000],
  ['Mini Burger Bonbon', 1, 2_070_000],
  ['Diet Pepsi', 1, 360_000],
  ['Diet Seven Up', 1, 360_000],
  ['Water Btl Large', 1, 900_000],
  ['Passion Fruit Martini', 1, 1_260_000],
  ['Midori Sour MZ', 3, 3_780_000],
  ['Satyr White Glass', 2, 1_800_000],
]

export const createDemoBill = mutation({
  args: { deviceId: v.string() },
  returns: v.id('bills'),
  handler: async (ctx, { deviceId }) => {
    if (deviceId.trim().length < 8) throw new ConvexError('Invalid device id')
    const { ok } = await rateLimiter.limit(ctx, 'createBillPerDevice', {
      key: deviceId,
    })
    if (!ok) {
      throw new ConvexError('Too many new bills from this device — try again in a bit.')
    }
    return await ctx.db.insert('bills', {
      merchantName: 'Maison Zola (sample)',
      branch: 'Gemmayze, Beirut',
      currencyPrimary: 'LBP',
      rate: 90_000,
      rateSource: 'receipt',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
      printedTotalLbp: 19_440_000,
      printedTotalUsd: 216,
      shareToken: newShareToken(),
      status: 'READY',
      version: 0,
      updatedAt: now(),
      lineItems: DEMO_LINES.map(([name, qty, lineTotal]) => ({
        id: newClientId(),
        name,
        qty,
        unitPrice: lineTotal / qty,
        lineTotal,
      })),
      people: [
        {
          id: newClientId(),
          name: DEFAULT_PERSON_NAME,
          color: nextPersonColor(0),
        },
      ],
    })
  },
})

export const saveWorking = mutation({
  args: {
    id: v.id('bills'),
    lineItems: v.optional(v.array(lineItem)),
    people: v.optional(v.array(person)),
    meta: v.optional(metaValidator),
  },
  returns: v.null(),
  handler: async (ctx, { id, lineItems, people, meta }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    // A finalized bill is a frozen receipt. Don't let a late flush mutate it.
    if (bill.status === 'FINALIZED') return null

    const splitIsLive = bill.status === 'PUBLISHED'
    const nextItems = lineItems ?? bill.lineItems
    const nextPeople = splitIsLive ? bill.people : (people ?? bill.people)
    // Claims are never submitted by the editor (they live in their own table,
    // written only by the scoped claim mutations below). The editor's job here
    // is to keep them CONSISTENT: reconcile the current rows against the next
    // items/people (drop orphans, scale over-claims) and sync the diff.
    const currentClaims = toWireClaims(await claimRowsForBill(ctx, id))
    const nextClaims = reconcileClaims(nextItems, nextPeople, currentClaims)
    validateLineItems(nextItems)
    validatePeople(nextPeople)
    validateClaims(nextItems, nextPeople, nextClaims)

    const patch: Record<string, unknown> = {
      lineItems: nextItems,
      people: nextPeople,
      version: bill.version + 1,
      updatedAt: now(),
      status: bill.status === 'PUBLISHED' ? 'PUBLISHED' : 'READY',
      ...definedOnly(meta ?? {}),
    }

    // Auto-derive the rate from printed totals unless the user set it manually.
    const printedLbp = meta?.printedTotalLbp ?? bill.printedTotalLbp
    const printedUsd = meta?.printedTotalUsd ?? bill.printedTotalUsd
    const nextRateSource = meta?.rateSource ?? bill.rateSource
    if (meta?.rate === undefined && nextRateSource !== 'manual') {
      const derived = deriveRate({
        printedTotalLbp: printedLbp,
        printedTotalUsd: printedUsd,
      })
      if (derived) {
        patch.rate = derived.rate
        patch.rateSource = derived.source
      }
    }

    await ctx.db.patch(id, patch)
    await syncClaimRows(ctx, id, nextClaims) // no-op unless items/people changed
    return null
  },
})

export const publish = mutation({
  args: { id: v.id('bills') },
  returns: v.string(),
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status !== 'PUBLISHED' && bill.status !== 'FINALIZED') {
      await ctx.db.patch(id, { status: 'PUBLISHED', updatedAt: now() })
    }
    return bill.shareToken
  },
})

export const finalize = mutation({
  args: { id: v.id('bills') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status !== 'FINALIZED') {
      await ctx.db.patch(id, { status: 'FINALIZED', updatedAt: now() })
    }
    return null
  },
})

// Unpublish: rotate the share token so the old link stops resolving, and drop
// back to READY so guests can no longer write. Publishing again issues the new
// link. (Spec §10: tokens must be revocable — a leaked link shouldn't live forever.)
export const revokeShare = mutation({
  args: { id: v.id('bills') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status === 'FINALIZED') {
      throw new ConvexError('This split has been finalized')
    }
    await ctx.db.patch(id, {
      shareToken: newShareToken(),
      status: bill.status === 'PUBLISHED' ? 'READY' : bill.status,
      version: bill.version + 1,
      updatedAt: now(),
    })
    return null
  },
})

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

export const saveHostClaims = mutation({
  args: {
    id: v.id('bills'),
    personId: v.string(),
    claims: v.array(guestClaimInput),
  },
  returns: v.object({
    acceptedClaims: v.array(claim),
    rejectedCount: v.number(),
  }),
  handler: async (ctx, { id, personId, claims }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertEditableSplit(bill)
    const person = bill.people.find((p) => p.id === personId)
    invariant(person, 'person not found')

    const currentClaims = toWireClaims(await claimRowsForBill(ctx, id))
    const result = saveClaimsForPerson(
      bill.lineItems,
      currentClaims,
      personId,
      claims,
    )
    await syncClaimRows(ctx, id, result.nextClaims)
    return {
      acceptedClaims: result.acceptedClaims,
      rejectedCount: result.rejectedCount,
    }
  },
})

export const shareHostItemEvenly = mutation({
  args: {
    id: v.id('bills'),
    itemId: v.string(),
    personIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, itemId, personIds }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertEditableSplit(bill)
    const item = bill.lineItems.find((li) => li.id === itemId)
    invariant(item, 'item not found')
    if (personIds.length === 0) throw new Error('Choose at least one person')
    const peopleIds = new Set(bill.people.map((p) => p.id))
    for (const personId of personIds) {
      if (!peopleIds.has(personId)) throw new Error('person not found')
    }

    const units = item.qty / personIds.length
    const currentClaims = toWireClaims(await claimRowsForBill(ctx, id))
    await syncClaimRows(ctx, id, [
      ...currentClaims.filter((c) => c.itemId !== itemId),
      ...personIds.map((personId) => ({ itemId, personId, units })),
    ])
    return null
  },
})

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
    claims: v.array(guestClaimInput),
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
