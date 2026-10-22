import { defineSchema, defineTable } from 'convex/server'
import { type Infer, v } from 'convex/values'

// Receipt Splitter data model — aggregate document + claim rows
// (architecture-decision.md, revisited 2026-07). One `bills` row holds the
// STABLE, BOUNDED parts of a bill as typed JSON arrays (lineItems / people);
// the HIGH-CHURN part — claims — lives in its own `claims` table keyed by
// billId. Rationale: every ctx.db.patch rewrites the whole document, so a doc
// that embeds claims pays a full-document write (and a full re-read by the
// subscribed query) on every claim tap. Rows make a claim tap a few
// hundred bytes of I/O and let 30 guests write concurrently without OCC
// conflicts on one shared document.
//
// IDs inside the arrays (and itemId/personId on claim rows) are client-
// generated strings (crypto.randomUUID()), not Convex Ids — editing stays
// plain local-state manipulation persisted via `saveWorking`.
//
// The wire shape is unchanged: `getBill` / `getBillByToken` assemble
// { ...bill, claims } so the frontend still sees one bill object.
//
// Rule for future tables (venues, table sessions, menu priors, reports):
// stable + bounded + bill-scoped → embed; high-churn, unbounded, or shared
// across bills → own table with an index.

export const rateSource = v.union(
  v.literal('receipt'),
  v.literal('market'),
  v.literal('manual'),
)
export const serviceSplitMode = v.union(
  v.literal('proportional'),
  v.literal('even'),
)
// Lifecycle: PENDING/NEEDS_REVIEW (extraction saved, awaiting tweaks) → READY
export const billStatus = v.union(
  v.literal('PENDING'),
  v.literal('NEEDS_REVIEW'),
  v.literal('READY'),
  v.literal('PUBLISHED'),
  v.literal('FINALIZED'),
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
  // Anonymous guests store a random session id locally. A claim has no owner of
  // its own — ownership is transitive: guestSessionId → person.id → claim.personId.
  // Rule enforced by the scoped guest mutations: you may edit a person (rename,
  // mark paid) iff person.guestSessionId === yourSession (or you're the host).
  // Claims are table-scoped: a session that owns at least one person on the
  // bill may claim for anyone at the table (assertSessionAtTable).
  // One session may own MANY people (a guest who joins via the link can add
  // himself, his girlfriend, etc.) — that's `addGuestPerson` stamping each new
  // person with the same session id. Everyone can READ the whole bill; you only
  // WRITE your own people (claims aside, see above). Version 2 invalidates credentials exposed by older responses.
  guestSessionId: v.optional(v.string()),
  guestAccessVersion: v.optional(v.literal(2)),
  // Mark-as-paid: when this person marked (or was marked) as having paid, ms
  // timestamp. Self-reported social signal, not accounting — at most one write
  // per person per bill, so it stays embedded per the embed-vs-row rule.
  paidAt: v.optional(v.number()),
})

// A claim is a (person, item) pair with a fractional unit count. countable lines
// use integer steppers (+1/-1); shared/indivisible lines use fractional units
// (e.g. 0.333 each for a 3-way split). Person's share for a line =
// units × (lineTotal / qty).
//
// This is the WIRE shape (what queries return inside the assembled bill and
// what mutations accept). Storage adds `billId` — see the `claims` table below.
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
    // `rate` is a direct, user-facing knob (LBP per USD), default 90000 — the
    // parallel-market rate that holds ~95% of the time. The user rarely touches
    // it. rateSource defaults to 'manual'; extraction may upgrade it to 'receipt'
    // when the paper prints both currency totals (deriveRate), but there is no
    // manual printed-total entry — see printedTotal* below.
    rate: v.optional(v.number()),
    rateSource,

    // Tax / service charge are OFF by default (ui-flow-vision.md): a plain bill
    // just splits its items. `serviceChargeOn` gates whether they're applied.
    serviceCharge: v.number(),
    tax: v.number(),
    serviceChargeOn: v.boolean(),
    serviceSplitMode,
    // Tip on top of the printed bill, as a percent of the CLAIMED subtotal,
    // distributed proportionally per person (split.ts). Separate from the
    // receipt's service charge and never part of the reconcile checksum.
    // Absent (older bills) means no tip; new bills start at 10.
    tipPercent: v.optional(v.number()),

    // Extraction-only reference: what the receipt itself printed. Never edited by
    // hand (the manual printed-total input was dropped — it fought the line items
    // as a second source of truth). The displayed total is always DERIVED from
    // lineItems (Σ lineTotal), and USD = derivedLbp / rate. These stay only to (a)
    // let extraction auto-derive the rate and (b) flag "items don't match receipt".
    printedTotalLbp: v.optional(v.number()),
    printedTotalUsd: v.optional(v.number()),

    // Storage-agnostic image ref (Convex storageId today, R2 key later). Cleared
    // after extraction (delete-after-extract). See convex/imageStore.ts.
    imageRef: v.optional(v.string()),

    shareToken: v.string(), // unguessable
    // The HOST's capability for this bill. The bill id lives in the address bar
    // (/review|/split|/summary/$billId) and in browser history, so it can't be
    // the secret that authorizes host writes — one pasted URL would hand a
    // stranger "edit items / revoke the link / finalize". This token is minted
    // server-side in createBill, returned exactly once, kept in localStorage on
    // the host's device, and required by every host mutation
    // (convex/bills/lib/functions.ts). It is NEVER returned by a query — the
    // wire shape is built by toWireBill (convex/model/bills.ts), which strips it.
    hostToken: v.string(),
    status: billStatus,
    // Set when the vision call failed or returned garbage — the review screen
    // offers "scan again / enter manually" instead of a silent empty bill.
    // Cleared on the next successful extraction or re-scan attempt.
    extractionError: v.optional(v.string()),
    // Action-retrier run id while an extraction is in flight; how the run's
    // onComplete callback finds this bill. Cleared on success or final failure.
    extractionRunId: v.optional(v.string()),
    extractionBaseVersion: v.optional(v.number()),
    // Bumped on every saveWorking flush; lets a viewer detect "edited elsewhere"
    // and reject a stale editor save before it replaces newer work.
    version: v.number(),
    updatedAt: v.number(),

    lineItems: v.array(lineItem),
    people: v.array(person), // seeded with a "self" person on create
  })
    .index('by_share_token', ['shareToken'])
    // Powers the TTL purge cron (oldest-inactive first).
    .index('by_updatedAt', ['updatedAt'])
    // Lets the storage-retention sweep distinguish orphaned uploads from an
    // image still owned by an in-flight extraction.
    .index('by_imageRef', ['imageRef'])
    // Powers the extraction onComplete callback (run id → bill).
    .index('by_extractionRunId', ['extractionRunId']),

  // High-churn child rows of a bill (see header comment). One row per
  // (item, person) pair; itemId/personId are the client-generated string ids
  // living inside the bill's embedded arrays. All access goes through
  // convex/model/claimRows.ts — mutations write row diffs, queries assemble
  // the wire shape. Claim writes deliberately do NOT touch the bill document.
  claims: defineTable({
    billId: v.id('bills'),
    itemId: v.string(),
    personId: v.string(),
    units: v.number(),
    // Claim writes deliberately avoid touching the subscribed bill document.
    // Keep their activity here instead so the TTL job can roll the newest
    // timestamp into bills.updatedAt without making concurrent claim taps
    // contend on one aggregate row. Optional for existing rows deployed before
    // activity tracking; their _creationTime is the fallback.
    updatedAt: v.optional(v.number()),
  })
    .index('by_bill', ['billId'])
    .index('by_bill_and_updatedAt', ['billId', 'updatedAt']),
})
export default schema

const bill = schema.tables.bills.validator
export type Bill = Infer<typeof bill>
export type LineItem = Infer<typeof lineItem>
export type Person = Infer<typeof person>
export type Claim = Infer<typeof claim>
