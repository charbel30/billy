import { v } from 'convex/values'
import {
  type MutationCtx,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import { invariant } from './invariant'
import * as imageStore from './imageStore'
import {
  type Claim,
  type LineItem,
  type Person,
  claim,
  lineItem,
  person,
  rateSource,
  serviceSplitMode,
} from './schema'
import { DEFAULT_RATE, deriveRate } from '../src/lib/currency'
import type { ExtractedReceipt } from '../src/lib/types'

// Single-document bill model (architecture-decision.md). Editing happens local-
// first in React state; the client flushes the whole working document with a
// debounced `saveWorking`. There is no per-interaction CRUD and no optimistic
// layer — just two mutations (saveWorking + publish) plus the image pipeline.

// Color palette for people chips, handed out round-robin (ui-flow-vision.md).
const PERSON_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

function newShareToken(): string {
  // Unguessable, expirable/revocable (spec §10). Two UUIDs of entropy.
  return (
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  )
}

function newId(): string {
  return crypto.randomUUID()
}

function definedOnly<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, val]) => val !== undefined),
  )
}

/** Drop/scale claims so the document stays internally consistent after edits:
 *  - remove claims that point at a deleted item or person;
 *  - if an item's summed claimed units exceed its qty (e.g. qty was lowered),
 *    scale that item's claims down proportionally so they fit (architecture-
 *    decision.md "orphan-claim reconcile"). Leftover (under-claimed) units are
 *    fine and left alone. */
function reconcileClaims(
  items: LineItem[],
  people: Person[],
  claims: Claim[],
): Claim[] {
  const itemById = new Map(items.map((i) => [i.id, i]))
  const personIds = new Set(people.map((p) => p.id))

  const live = claims.filter(
    (c) => itemById.has(c.itemId) && personIds.has(c.personId) && c.units > 0,
  )

  // Scale per item when over-claimed.
  const claimedByItem = new Map<string, number>()
  for (const c of live) {
    claimedByItem.set(c.itemId, (claimedByItem.get(c.itemId) ?? 0) + c.units)
  }
  return live.map((c) => {
    const item = itemById.get(c.itemId)!
    const claimed = claimedByItem.get(c.itemId) ?? 0
    if (item.qty > 0 && claimed > item.qty) {
      return { ...c, units: (c.units * item.qty) / claimed }
    }
    return c
  })
}

// ---------------------------------------------------------------------------
// Reads — the whole bill is one document, so reads are a single get.
// ---------------------------------------------------------------------------

export const getBill = query({
  args: { id: v.id('bills') },
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    return bill
  },
})

export const getBillByToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    const bill = await ctx.db
      .query('bills')
      .withIndex('by_share_token', (q) => q.eq('shareToken', shareToken))
      .unique()
    invariant(bill, 'bill not found')
    return bill
  },
})

// ---------------------------------------------------------------------------
// Create — seeds an empty working bill with a "self" person (ui-flow-vision.md:
// the bill is yours by default). Tax/service start OFF.
// ---------------------------------------------------------------------------

export const createBill = mutation({
  args: {
    merchantName: v.optional(v.string()),
    currencyPrimary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bills', {
      merchantName: args.merchantName ?? '',
      currencyPrimary: args.currencyPrimary ?? 'LBP',
      rate: DEFAULT_RATE,
      rateSource: 'market',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
      shareToken: newShareToken(),
      status: 'PENDING',
      version: 0,
      lineItems: [],
      people: [{ id: newId(), name: 'self', color: PERSON_COLORS[0] }],
      claims: [],
    })
  },
})

// ---------------------------------------------------------------------------
// saveWorking — the debounced flush. Full-document replace of whatever arrays /
// meta the client sends; everything omitted is left untouched. Idempotent.
// ---------------------------------------------------------------------------

const metaValidator = v.object({
  merchantName: v.optional(v.string()),
  branch: v.optional(v.string()),
  datetime: v.optional(v.string()),
  currencyPrimary: v.optional(v.string()),
  rate: v.optional(v.number()),
  rateSource: v.optional(rateSource),
  serviceCharge: v.optional(v.number()),
  tax: v.optional(v.number()),
  serviceChargeOn: v.optional(v.boolean()),
  serviceSplitMode: v.optional(serviceSplitMode),
  printedTotalLbp: v.optional(v.number()),
  printedTotalUsd: v.optional(v.number()),
})

export const saveWorking = mutation({
  args: {
    id: v.id('bills'),
    lineItems: v.optional(v.array(lineItem)),
    people: v.optional(v.array(person)),
    claims: v.optional(v.array(claim)),
    meta: v.optional(metaValidator),
  },
  handler: async (ctx, { id, lineItems, people, claims, meta }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    // A published bill is a frozen snapshot — don't let a late flush mutate it.
    if (bill.status === 'PUBLISHED') return

    const nextItems = lineItems ?? bill.lineItems
    const nextPeople = people ?? bill.people
    const nextClaims = reconcileClaims(
      nextItems,
      nextPeople,
      claims ?? bill.claims,
    )

    const patch: Record<string, unknown> = {
      lineItems: nextItems,
      people: nextPeople,
      claims: nextClaims,
      version: bill.version + 1,
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
  },
})

// ---------------------------------------------------------------------------
// publish — freeze the bill as a shareable snapshot and hand back its token.
// ---------------------------------------------------------------------------

export const publish = mutation({
  args: { id: v.id('bills') },
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status !== 'PUBLISHED') {
      await ctx.db.patch(id, { status: 'PUBLISHED' })
    }
    return bill.shareToken
  },
})

// ---------------------------------------------------------------------------
// Image upload + extraction pipeline (spec §3, §4)
// ---------------------------------------------------------------------------

/** Step 1: hand the browser a URL to POST the compressed image bytes to. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await imageStore.createUploadTarget(ctx),
})

/** Step 2: attach the uploaded image to the bill and kick off the vision action.
 *  Mutations can't fetch, so we schedule the action to run immediately after. */
export const attachImageAndExtract = mutation({
  args: { billId: v.id('bills'), imageRef: v.string() },
  handler: async (ctx, { billId, imageRef }) => {
    const bill = await ctx.db.get(billId)
    invariant(bill, `missing bill ${billId}`)
    await ctx.db.patch(billId, { imageRef })
    await ctx.scheduler.runAfter(0, internal.extract.extractReceipt, {
      billId,
      imageRef,
    })
  },
})

/** Step 4: persist the model's output into the document arrays. Idempotent on
 *  billId — the action can retry, so we replace lineItems wholesale and reset
 *  claims (spec §4.3). The bill returns to PENDING for the human review pass. */
export const applyExtraction = internalMutation({
  args: { billId: v.id('bills'), parsed: v.any() },
  handler: async (ctx: MutationCtx, { billId, parsed }) => {
    const bill = await ctx.db.get(billId)
    if (!bill) return
    const receipt = parsed as ExtractedReceipt

    const items: LineItem[] = (receipt.line_items ?? []).map((i) => ({
      id: newId(),
      name: i.name,
      qty: i.qty,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      confidence: i.confidence,
    }))

    const derived = deriveRate({
      printedTotalLbp: receipt.printed_total_lbp,
      printedTotalUsd: receipt.printed_total_usd,
    })

    await ctx.db.patch(billId, {
      merchantName: receipt.merchant ?? bill.merchantName,
      branch: receipt.branch ?? bill.branch,
      datetime: receipt.datetime ?? bill.datetime,
      currencyPrimary: receipt.currency_primary || bill.currencyPrimary || 'LBP',
      serviceCharge: receipt.service_charge ?? 0,
      tax: receipt.tax ?? 0,
      printedTotalLbp: receipt.printed_total_lbp ?? undefined,
      printedTotalUsd: receipt.printed_total_usd ?? undefined,
      ...(derived
        ? { rate: derived.rate, rateSource: derived.source }
        : { rate: DEFAULT_RATE, rateSource: 'market' as const }),
      lineItems: items,
      claims: [], // fresh extraction → nothing claimed yet
      imageRef: undefined, // delete-after-extract: clear the ref (spec §10)
      status: 'PENDING',
      version: bill.version + 1,
    })
  },
})
