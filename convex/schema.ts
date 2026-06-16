import { defineSchema, defineTable } from 'convex/server'
import { type Infer, v } from 'convex/values'

// Receipt Splitter data model — single-document design (architecture-decision.md).
// One `bills` row holds the WHOLE bill as typed JSON arrays (lineItems / people /
// claims); there are no child tables. IDs inside those arrays are client-generated
// strings (crypto.randomUUID()), not Convex Ids — so editing is plain local-state
// manipulation and persisting is one full-document replace via `saveWorking`.
//
// Receipts are tiny and bounded (a handful of lines/people), so the usual
// "don't store unbounded arrays in a document" guidance doesn't apply here — this
// is the deliberate trade made in architecture-decision.md (§"Why" / §"What we
// give up": one row per bill, last-write-wins, replace-on-flush).

export const rateSource = v.union(
  v.literal('receipt'),
  v.literal('market'),
  v.literal('manual'),
)
export const serviceSplitMode = v.union(
  v.literal('proportional'),
  v.literal('even'),
)
// Lifecycle: PENDING (extraction saved, awaiting tweaks) → READY (reconciled/
// edited) → PUBLISHED (final shareable snapshot).
export const billStatus = v.union(
  v.literal('PENDING'),
  v.literal('READY'),
  v.literal('PUBLISHED'),
)

// Reusable element validators — shared by the schema and by `saveWorking` args so
// the document and the mutation stay in lockstep (and end-to-end typed).
export const lineItem = v.object({
  id: v.string(), // client-generated, unique within the bill
  name: v.string(),
  qty: v.number(),
  unitPrice: v.number(),
  lineTotal: v.number(), // source of truth; effectiveUnitPrice = lineTotal / qty
  confidence: v.optional(v.number()), // <1 → "check this" flag in review
})

export const person = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
})

// A claim is a (person, item) pair with a fractional unit count. countable lines
// use integer steppers (+1/-1); shared/indivisible lines use fractional units
// (e.g. 0.333 each for a 3-way split). Person's share for a line =
// units × (lineTotal / qty).
export const claim = v.object({
  itemId: v.string(),
  personId: v.string(),
  units: v.number(),
})

const schema = defineSchema({
  bills: defineTable({
    ownerId: v.optional(v.id('users')), // users table omitted in MVP; optional for later
    merchantName: v.string(),
    branch: v.optional(v.string()),
    datetime: v.optional(v.string()),
    currencyPrimary: v.string(), // usually "LBP"
    rate: v.optional(v.number()), // LBP per USD
    rateSource,

    // Tax / service charge are OFF by default (ui-flow-vision.md): a plain bill
    // just splits its items. `serviceChargeOn` gates whether they're applied.
    serviceCharge: v.number(),
    tax: v.number(),
    serviceChargeOn: v.boolean(),
    serviceSplitMode,

    printedTotalLbp: v.optional(v.number()),
    printedTotalUsd: v.optional(v.number()),

    // Storage-agnostic image ref (Convex storageId today, R2 key later). Cleared
    // after extraction (delete-after-extract). See convex/imageStore.ts.
    imageRef: v.optional(v.string()),

    shareToken: v.string(), // unguessable
    status: billStatus,
    // Bumped on every saveWorking flush; lets a viewer detect "edited elsewhere"
    // (last-write-wins otherwise).
    version: v.number(),

    lineItems: v.array(lineItem),
    people: v.array(person), // seeded with a "self" person on create
    claims: v.array(claim),
  }).index('by_share_token', ['shareToken']),
})
export default schema

const bill = schema.tables.bills.validator
export type Bill = Infer<typeof bill>
export type LineItem = Infer<typeof lineItem>
export type Person = Infer<typeof person>
export type Claim = Infer<typeof claim>
