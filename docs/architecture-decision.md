# Architecture Decision — Bill Storage & Editing Model

Status: **implemented; revisited 2026-07-06** (claims moved to their own table — see
§Revisited below). Companion to `ui-flow-vision.md` (the UX intent) and
`receipt-splitter-build-spec.md` (product logic). This records *how* we store and edit a
bill, why, and what's left to research.

## Decision (as revised 2026-07-06)

Store each bill as **one `bills` row** holding the **stable, bounded** parts as typed JSON
arrays (`lineItems`, `people`, meta) — plus a **separate `claims` table** for the
**high-churn** part (one row per (item, person) pair, `by_bill` index). Edit items/people/meta
**local-first** in React state and persist with a **debounced autosave (~5s)**; write claims
through **scoped per-person mutations** as row diffs.

Lifecycle: **PENDING** (LLM extraction saved, awaiting tweaks) → **READY** (reconciled/edited)
→ **PUBLISHED** (live shareable split) → **FINALIZED** (frozen receipt).

### Shape (sketch)
```
bills (one row = the bill's stable core)
  merchant, branch, datetime, currencyPrimary, rate, rateSource
  serviceCharge: 0, tax: 0, serviceChargeOn: false   // OFF by default
  printedTotalLbp?, printedTotalUsd?
  imageRef?, shareToken, status   // PENDING | NEEDS_REVIEW | READY | PUBLISHED | FINALIZED
  lineItems: [{ id, name, qty, unitPrice, lineTotal, confidence }]
  people:    [{ id, name, color, guestSessionId? }]  // starts with "self"

claims (child rows, high-churn)                       // .index('by_bill', ['billId'])
  { billId, itemId, personId, units }                 // units is a NUMBER (fractional allowed)
```
The **wire shape is still one bill object**: `getBill` / `getBillByToken` assemble
`{ ...bill, claims }`, so the frontend never sees the split.
- `id`s are **client-generated strings inside the document** (no Convex `Id` juggling).
- Arrays are validated with `v.object`/`v.array` — still end-to-end typed, just denormalized.
- Two mutations replace all CRUD: **`saveWorking({ id, lineItems?, people?, claims?, meta? })`**
  (the debounced flush) and **`publish({ id })`**.
- Editing in local state means the **optimistic-update layer in `queries.ts` is removed**.
- Split math becomes **`person share = Σ claimed_units × unitPrice`** (rework `split.ts`).

## Resolved decisions (bill phase)

- **`lineTotal` is always the source of truth.** Derive `effectiveUnitPrice = lineTotal / qty`
  and split with it, so per-person totals always reconcile to the printed bill even when
  `qty × unitPrice` disagrees (discounts, rounding, weight items).
- **`claims.units` is a single fractional number** — no separate "mode". Handles every line:
  - countable (qty > 1, integer) → `+1 / −1` steppers in the UI;
  - shared / indivisible (qty 1, or non-integer/weight) → a "share evenly among…" picker that
    writes fractional units (e.g. 0.333 each for a 3-way pizza).
  - Person's share for a line = `claimedUnits × effectiveUnitPrice`.
- **Leftover (unclaimed) units are normal, not an error.** They mean counting stopped, the line
  was comped, or someone already paid it. Surface them as "remaining on the bill," with an
  explicit user decision (e.g. mark paid / removed / ignore) — TBD how that's recorded.
- **Flush = full replace of items/people/meta** (not array patch). Bills are tiny; replace is
  simplest and idempotent. Claims are excluded — they're row-diffed (2026-07-06 revision).
- **Sync/offline (all adopted):** load-once then local-state-owns-while-dirty; a `version`/
  `updatedAt` field to detect "edited elsewhere" (last-write-wins otherwise); flush on debounce
  **and** on `visibilitychange`/`pagehide`/route-change; mirror working state to `localStorage`
  and replay on reconnect.

## Why

- **Cost is a non-issue either way.** Convex free tier = 1M function calls/mo. A debounced
  flow is ~10–40 calls per bill → tens of thousands of bills/month free. The expensive part
  is Gemini extraction, not DB writes.
- **Cleaner storage.** One row per bill instead of churning `assignments` rows.
- **Fits the vision.** Local-first = instant unit-by-unit splitting and "works offline at the
  table" (a stated constraint). Items come from the LLM, so manual edits are rare anyway.
- **Near-live sharing for free.** Each flush updates the single doc, so Convex pushes it to
  `/b/:token` viewers — they see updates within ~5s with no extra machinery.
- **Tax/service OFF by default** (`serviceChargeOn: false`); opt-in.

## What we give up

- ~~**True real-time, multi-writer guest-claim** (several people claiming their own items live,
  each tap a conflict-free row). With a single JSON doc, concurrent editors are last-write-wins.
  Acceptable because **one person runs the bill** in practice; viewers are read-only.~~
  **Resolved by the 2026-07-06 revision:** claims ARE conflict-free rows now; each guest tap
  writes only their own rows, no OCC contention on a shared document.
- Items/people/meta remain last-write-wins between concurrent hosts (the `version` field is
  the "edited elsewhere" hint). Claim-row changes no longer bump `version` — they don't touch
  the bill document at all.

## Revisited 2026-07-06 — claims moved to their own table

**Trigger:** Convex's own guidance (`convex/_generated/ai/guidelines.md`) has two rules the
original design brushed against: (1) don't store *unbounded* lists as document arrays —
"every update rewrites the entire document"; (2) separate *high-churn* operational data from
stable data into its own table. Billy's arrays are all **bounded** (receipt-sized items,
30-person guest cap), so rule 1 never applied — but `claims` is exactly rule 2's case: during
a live split every tap rewrote the whole document.

**The cost mechanics (verified against docs + pricing, 2026-07-06):**
- Any `ctx.db.patch`, however small, rewrites the full document in the log. With embedded
  claims, one claim tap ≈ mutation read + full-doc write + subscribed-query re-read ≈
  **3× document size of billed "Database I/O"** (Free/Starter: 1 GB/mo included, $0.22/GB
  after; Pro: 50 GB, $0.20/GB).
- Subscriber count does **not** multiply cost: Convex caches query results per (query, args),
  so 8 guests on one `getBillByToken` share a single re-run. WebSocket egress to clients is
  not billed — only function↔DB I/O is.
- At venue scale (~20 venues × 30 sessions/night, ~30 KB club-tab docs) embedded claims
  penciled out to ~100 GB/mo ≈ $10–20/mo — survivable, but pure waste, and the same design
  serialized 30 concurrently-tapping guests through OCC conflicts on one document.

**Why now:** no production user data existed, so the migration cost was zero — the dev table
was purged and the correct schema deployed directly.

**What deliberately stayed embedded:** `lineItems`, `people`, and meta. They are stable,
bounded, atomic with the reconcile checksum, and owned by the local-first editor. Full
normalization would re-create the joined-read/atomicity problems for no bandwidth win (the
reactive query re-reads the whole bill either way).

**Code shape:** `convex/bills/claimRows.ts` is the single seam (read rows, wire-shape
mapping, keyed row-diff sync). Scoped claim mutations write row diffs and do **not** touch
the bill doc (no `version`/`updatedAt` bump). `saveWorking` no longer accepts claims — it
reconciles the current rows server-side when items/people change. The TTL purge cron
cascade-deletes claim rows.

**Rule for future tables** (venues, table sessions, menu priors, reports): stable + bounded +
bill-scoped → embed in the bill; high-churn, unbounded, or shared across bills → own table
with an index. When per-venue reporting needs counts/sums across many bills, use
`@convex-dev/aggregate`, not schema surgery.

## To research / revisit before it can improve

- ~~**Live multi-person claim (Phase 2):** re-normalize just the `claims` into rows; or
  per-person sub-documents; or a CRDT / OT layer.~~ **Done 2026-07-06** — claims are rows
  (exactly the "re-normalize just the claims" option; see §Revisited).
- **Discounts / negative lines:** how comps, deposits, and discount rows appear (negative line
  items vs bill-level adjustment) and how they distribute. They also break the reconcile checksum.
- **Leftover-units recording:** how the "remaining on the bill" decision is stored (paid / removed
  / ignore) and whether it affects the grand total.
- **Orphan-claim reconcile:** when an item is deleted or its qty edited below claimed units,
  `saveWorking` must drop/scale the affected claims (no cascade now that it's one JSON doc).
- **`visibilitychange`/`pagehide` reliability on mobile:** confirm the event that actually fires
  before a backgrounded mobile tab is killed (`beforeunload` is unreliable on iOS Safari).
- **Share-as-image:** client-side render of the bill summary to PNG for WhatsApp sharing.
- **Extraction eval set:** 20–30 real Lebanese receipts (clean/occluded/Arabic/discounted) to
  tune the prompt and measure checksum pass-rate; drives quality more than model choice.
- **Published immutability:** should `PUBLISHED` be a frozen snapshot separate from an editable
  copy (re-open → new working version)? Decide history semantics.
- **Gemini 3 structured output:** we currently prompt for JSON + strip fences because
  `responseSchema`/`responseFormat` are rejected on `generateContent` for gemini-3.x. Revisit
  structured-output (or the Interactions API) when it stabilizes for stricter guarantees.
- **Flash → Pro escalation:** on checksum fail / low confidence, re-run extraction with a pro
  model before flagging NEEDS_REVIEW.
- **Market-rate feed (Phase 2):** only when a receipt lacks both currency totals.
- **Image privacy/TTL:** keep delete-after-extract; if images are ever retained, add the TTL purge.
- **Validation depth:** how strictly to validate the JSON arrays on `saveWorking` vs staying
  permissive for forward-compat.
