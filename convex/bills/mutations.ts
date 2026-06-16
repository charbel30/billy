import { v } from 'convex/values'
import { mutation, type MutationCtx } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { claim, lineItem, person, type Bill, type Claim, type LineItem, type Person } from '../schema'
import { metaValidator } from './validators'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import { DEFAULT_PERSON_NAME } from '../../src/lib/bill/constants'
import { newClientId, newShareToken, nextPersonColor } from '../../src/lib/bill/ids'
import { reconcileClaims } from '../../src/lib/bill/edits'

const MAX_NAME_LENGTH = 48

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

export const createBill = mutation({
  args: {
    merchantName: v.optional(v.string()),
    currencyPrimary: v.optional(v.string()),
  },
  returns: v.id('bills'),
  handler: async (ctx, args) => {
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
      claims: [],
    })
  },
})

export const saveWorking = mutation({
  args: {
    id: v.id('bills'),
    lineItems: v.optional(v.array(lineItem)),
    people: v.optional(v.array(person)),
    claims: v.optional(v.array(claim)),
    meta: v.optional(metaValidator),
  },
  returns: v.null(),
  handler: async (ctx, { id, lineItems, people, claims, meta }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    // A published bill is a frozen snapshot. Don't let a late flush mutate it.
    if (bill.status === 'PUBLISHED') return null

    const nextItems = lineItems ?? bill.lineItems
    const nextPeople = people ?? bill.people
    const nextClaims = reconcileClaims(
      nextItems,
      nextPeople,
      claims ?? bill.claims,
    )
    validateLineItems(nextItems)
    validatePeople(nextPeople)
    validateClaims(nextItems, nextPeople, nextClaims)

    const patch: Record<string, unknown> = {
      lineItems: nextItems,
      people: nextPeople,
      claims: nextClaims,
      version: bill.version + 1,
      updatedAt: now(),
      status: 'READY',
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
    return null
  },
})

export const publish = mutation({
  args: { id: v.id('bills') },
  returns: v.string(),
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status !== 'PUBLISHED') {
      await ctx.db.patch(id, { status: 'PUBLISHED', updatedAt: now() })
    }
    return bill.shareToken
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
    const person = bill.people.find((p) => p.id === personId)
    invariant(person, 'person not found')
    if (person.guestSessionId !== guestSessionId) {
      throw new Error('You can only edit your own claims')
    }

    const itemById = new Map(bill.lineItems.map((item) => [item.id, item]))
    const otherClaims = bill.claims.filter((c) => c.personId !== personId)
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

    await ctx.db.patch(bill._id, {
      claims: [...otherClaims, ...acceptedClaims],
      version: bill.version + 1,
      updatedAt: now(),
    })

    return { acceptedClaims, rejectedCount }
  },
})
