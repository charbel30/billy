import { v } from 'convex/values'
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { invariant } from './invariant'
import * as imageStore from './imageStore'
import { rateSource, serviceSplitMode } from './schema'
import { reconcile } from '../src/lib/reconcile'
import { deriveRate } from '../src/lib/currency'
import type { ExtractedReceipt } from '../src/lib/types'

// Below which a line item's confidence forces a human review (spec §4.4).
const CONFIDENCE_THRESHOLD = 0.6

// Color palette for people chips, handed out round-robin (spec §8.2 PersonChips).
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

// ---------------------------------------------------------------------------
// Reads — assemble a whole bill into one consistent server-side snapshot.
// ---------------------------------------------------------------------------

async function assembleBill(ctx: QueryCtx, bill: Doc<'bills'>) {
  const [lineItems, people, assignments] = await Promise.all([
    ctx.db.query('lineItems').withIndex('by_bill', (q) => q.eq('billId', bill._id)).collect(),
    ctx.db.query('people').withIndex('by_bill', (q) => q.eq('billId', bill._id)).collect(),
    ctx.db.query('assignments').withIndex('by_bill', (q) => q.eq('billId', bill._id)).collect(),
  ])
  return { bill, lineItems, people, assignments }
}

export const getBill = query({
  args: { id: v.id('bills') },
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    return await assembleBill(ctx, bill)
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
    return await assembleBill(ctx, bill)
  },
})

// ---------------------------------------------------------------------------
// Status routing — re-run the checksum after any change that affects it.
// ---------------------------------------------------------------------------

async function recomputeStatus(ctx: MutationCtx, billId: Id<'bills'>) {
  const bill = await ctx.db.get(billId)
  if (!bill || bill.status === 'SHARED') return // don't downgrade a shared bill
  const lineItems = await ctx.db
    .query('lineItems')
    .withIndex('by_bill', (q) => q.eq('billId', billId))
    .collect()
  const res = reconcile({
    lineItems,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    printedTotal: bill.printedTotalLbp ?? null,
  })
  const status = res.ok ? 'READY' : 'NEEDS_REVIEW'
  if (status !== bill.status) await ctx.db.patch(billId, { status })
}

/** Equal-split a shared item: every assignee gets 1/count after add/remove. */
async function rebalanceItem(ctx: MutationCtx, lineItemId: Id<'lineItems'>) {
  const rows = await ctx.db
    .query('assignments')
    .withIndex('by_line_item', (q) => q.eq('lineItemId', lineItemId))
    .collect()
  const frac = rows.length ? 1 / rows.length : 0
  await Promise.all(rows.map((r) => ctx.db.patch(r._id, { shareFraction: frac })))
}

function definedOnly<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, val]) => val !== undefined),
  )
}

// ---------------------------------------------------------------------------
// Bill lifecycle
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
      rateSource: 'manual',
      serviceCharge: 0,
      tax: 0,
      serviceSplitMode: 'proportional',
      shareToken: newShareToken(),
      status: 'DRAFT',
    })
  },
})

export const updateBillMeta = mutation({
  args: {
    id: v.id('bills'),
    merchantName: v.optional(v.string()),
    branch: v.optional(v.string()),
    datetime: v.optional(v.string()),
    serviceCharge: v.optional(v.number()),
    tax: v.optional(v.number()),
    rate: v.optional(v.number()),
    rateSource: v.optional(rateSource),
    serviceSplitMode: v.optional(serviceSplitMode),
    printedTotalLbp: v.optional(v.number()),
    printedTotalUsd: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    await ctx.db.patch(id, definedOnly(patch))

    // Auto-derive the rate from printed totals unless the user set it manually.
    const fresh = await ctx.db.get(id)
    if (fresh && patch.rate === undefined && fresh.rateSource !== 'manual') {
      const derived = deriveRate({
        printedTotalLbp: fresh.printedTotalLbp,
        printedTotalUsd: fresh.printedTotalUsd,
      })
      if (derived && (fresh.rate !== derived.rate || fresh.rateSource !== 'receipt')) {
        await ctx.db.patch(id, { rate: derived.rate, rateSource: derived.source })
      }
    }
    await recomputeStatus(ctx, id)
  },
})

export const finalizeShare = mutation({
  args: { id: v.id('bills') },
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status !== 'SHARED') await ctx.db.patch(id, { status: 'SHARED' })
    return bill.shareToken
  },
})

export const deleteBill = mutation({
  args: { id: v.id('bills') },
  handler: async (ctx, { id }) => {
    const [lineItems, people, assignments] = await Promise.all([
      ctx.db.query('lineItems').withIndex('by_bill', (q) => q.eq('billId', id)).collect(),
      ctx.db.query('people').withIndex('by_bill', (q) => q.eq('billId', id)).collect(),
      ctx.db.query('assignments').withIndex('by_bill', (q) => q.eq('billId', id)).collect(),
    ])
    await Promise.all([
      ...lineItems.map((d) => ctx.db.delete(d._id)),
      ...people.map((d) => ctx.db.delete(d._id)),
      ...assignments.map((d) => ctx.db.delete(d._id)),
    ])
    await ctx.db.delete(id)
  },
})

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

export const addLineItem = mutation({
  args: {
    billId: v.id('bills'),
    name: v.string(),
    qty: v.number(),
    unitPrice: v.number(),
    lineTotal: v.optional(v.number()),
    currency: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId)
    invariant(bill, `missing bill ${args.billId}`)
    await ctx.db.insert('lineItems', {
      billId: args.billId,
      name: args.name,
      qty: args.qty,
      unitPrice: args.unitPrice,
      lineTotal: args.lineTotal ?? args.qty * args.unitPrice,
      currency: args.currency ?? bill.currencyPrimary,
      confidence: args.confidence,
    })
    await recomputeStatus(ctx, args.billId)
  },
})

export const updateLineItem = mutation({
  args: {
    id: v.id('lineItems'),
    name: v.optional(v.string()),
    qty: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
    lineTotal: v.optional(v.number()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const item = await ctx.db.get(id)
    invariant(item, `missing line item ${id}`)
    await ctx.db.patch(id, definedOnly(patch))
    await recomputeStatus(ctx, item.billId)
  },
})

export const deleteLineItem = mutation({
  args: { id: v.id('lineItems') },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id)
    invariant(item, `missing line item ${id}`)
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_line_item', (q) => q.eq('lineItemId', id))
      .collect()
    await Promise.all(assignments.map((a) => ctx.db.delete(a._id)))
    await ctx.db.delete(id)
    await recomputeStatus(ctx, item.billId)
  },
})

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const addPerson = mutation({
  args: { billId: v.id('bills'), name: v.string() },
  handler: async (ctx, { billId, name }) => {
    const bill = await ctx.db.get(billId)
    invariant(bill, `missing bill ${billId}`)
    const existing = await ctx.db
      .query('people')
      .withIndex('by_bill', (q) => q.eq('billId', billId))
      .collect()
    await ctx.db.insert('people', {
      billId,
      name,
      color: PERSON_COLORS[existing.length % PERSON_COLORS.length],
    })
  },
})

export const updatePerson = mutation({
  args: { id: v.id('people'), name: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, { id, ...patch }) => {
    const person = await ctx.db.get(id)
    invariant(person, `missing person ${id}`)
    await ctx.db.patch(id, definedOnly(patch))
  },
})

export const deletePerson = mutation({
  args: { id: v.id('people') },
  handler: async (ctx, { id }) => {
    const person = await ctx.db.get(id)
    invariant(person, `missing person ${id}`)
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_person', (q) => q.eq('personId', id))
      .collect()
    // Removing a person can change shared-item splits — rebalance affected items.
    const touchedItems = new Set(assignments.map((a) => a.lineItemId))
    await Promise.all(assignments.map((a) => ctx.db.delete(a._id)))
    await ctx.db.delete(id)
    await Promise.all([...touchedItems].map((itemId) => rebalanceItem(ctx, itemId)))
  },
})

// ---------------------------------------------------------------------------
// Assignments (item <-> person)
// ---------------------------------------------------------------------------

export const toggleAssignment = mutation({
  args: {
    billId: v.id('bills'),
    lineItemId: v.id('lineItems'),
    personId: v.id('people'),
  },
  handler: async (ctx, { billId, lineItemId, personId }) => {
    const existing = await ctx.db
      .query('assignments')
      .withIndex('by_line_item', (q) => q.eq('lineItemId', lineItemId))
      .collect()
    const mine = existing.find((a) => a.personId === personId)
    if (mine) {
      await ctx.db.delete(mine._id)
    } else {
      await ctx.db.insert('assignments', { billId, lineItemId, personId, shareFraction: 1 })
    }
    await rebalanceItem(ctx, lineItemId)
  },
})

export const updateShareFraction = mutation({
  args: { id: v.id('assignments'), shareFraction: v.number() },
  handler: async (ctx, { id, shareFraction }) => {
    const a = await ctx.db.get(id)
    invariant(a, `missing assignment ${id}`)
    await ctx.db.patch(id, { shareFraction })
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

/** Step 4: persist the model's output. Idempotent on billId — actions can retry,
 *  so we clear existing line items/assignments before inserting (spec §4.3). */
export const applyExtraction = internalMutation({
  args: { billId: v.id('bills'), parsed: v.any() },
  handler: async (ctx, { billId, parsed }) => {
    const bill = await ctx.db.get(billId)
    if (!bill) return
    const receipt = parsed as ExtractedReceipt

    const [oldItems, oldAssignments] = await Promise.all([
      ctx.db.query('lineItems').withIndex('by_bill', (q) => q.eq('billId', billId)).collect(),
      ctx.db.query('assignments').withIndex('by_bill', (q) => q.eq('billId', billId)).collect(),
    ])
    await Promise.all([
      ...oldItems.map((d) => ctx.db.delete(d._id)),
      ...oldAssignments.map((d) => ctx.db.delete(d._id)),
    ])

    const currency = receipt.currency_primary || bill.currencyPrimary || 'LBP'
    const items = receipt.line_items ?? []
    for (const item of items) {
      await ctx.db.insert('lineItems', {
        billId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
        currency,
        confidence: item.confidence,
      })
    }

    const derived = deriveRate({
      printedTotalLbp: receipt.printed_total_lbp,
      printedTotalUsd: receipt.printed_total_usd,
    })

    // Route on checksum AND confidence (spec §4.3/§4.4).
    const res = reconcile({
      lineItems: items.map((i) => ({ lineTotal: i.line_total })),
      serviceCharge: receipt.service_charge ?? 0,
      tax: receipt.tax ?? 0,
      printedTotal: receipt.printed_total_lbp ?? null,
    })
    const lowConfidence = items.some((i) => (i.confidence ?? 1) < CONFIDENCE_THRESHOLD)
    const status = res.ok && !lowConfidence ? 'READY' : 'NEEDS_REVIEW'

    await ctx.db.patch(billId, {
      merchantName: receipt.merchant ?? bill.merchantName,
      branch: receipt.branch ?? bill.branch,
      datetime: receipt.datetime ?? bill.datetime,
      currencyPrimary: currency,
      serviceCharge: receipt.service_charge ?? 0,
      tax: receipt.tax ?? 0,
      printedTotalLbp: receipt.printed_total_lbp ?? undefined,
      printedTotalUsd: receipt.printed_total_usd ?? undefined,
      ...(derived ? { rate: derived.rate, rateSource: derived.source } : {}),
      imageRef: undefined, // delete-after-extract: clear the ref (spec §10)
      status,
    })
  },
})
