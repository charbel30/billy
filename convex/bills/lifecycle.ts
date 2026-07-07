import { ConvexError, v } from 'convex/values'
import { mutation } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { rateLimiter } from '../lib/rateLimits'
import { lineItem, person } from '../schema'
import { claimRowsForBill, syncClaimRows, toWireClaims } from './claimRows'
import { metaValidator } from './validators'
import {
  assertEditableSplit,
  assertFiniteNumber,
  definedOnly,
  now,
  validateClaims,
  validateLineItems,
  validatePeople,
} from '../model/bills'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import {
  DEFAULT_PERSON_NAME,
  DEFAULT_TIP_PERCENT,
  MAX_TIP_PERCENT,
} from '../../src/lib/bill/constants'
import { newClientId, newShareToken, nextPersonColor } from '../../src/lib/bill/ids'
import { reconcileClaims } from '../../src/lib/bill/edits'

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
      tipPercent: DEFAULT_TIP_PERCENT,
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
      tipPercent: DEFAULT_TIP_PERCENT,
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
    // written only by the scoped claim mutations). The editor's job here
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

// Tip is bill-meta (host-only knob), so this is a normal bill patch with a
// version bump — unlike claims. It's excluded from metaValidator on purpose:
// this mutation is the ONLY writer, so a stale saveWorking flush can't touch it.
export const setTipPercent = mutation({
  args: {
    id: v.id('bills'),
    tipPercent: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { id, tipPercent }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    assertEditableSplit(bill)
    assertFiniteNumber(tipPercent, 'Tip percent')
    if (tipPercent < 0 || tipPercent > MAX_TIP_PERCENT) {
      throw new Error(`Tip must be between 0 and ${MAX_TIP_PERCENT}%`)
    }
    await ctx.db.patch(id, {
      tipPercent,
      version: bill.version + 1,
      updatedAt: now(),
    })
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
