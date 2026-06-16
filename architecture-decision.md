# Architecture Decision — Bill Storage & Editing Model

Status: **decided, not yet implemented.** Companion to `ui-flow-vision.md` (the UX intent)
and `receipt-splitter-build-spec.md` (product logic). This records *how* we store and edit a
bill, why, and what's left to research.

## Decision

Store each bill as **one `bills` row** that holds the whole bill as **typed JSON arrays**
(not separate `lineItems` / `people` / `assignments` tables). Edit **local-first** in React
state and persist with a **debounced autosave (~5s)**, not a write per interaction.

Lifecycle: **PENDING** (LLM extraction saved, awaiting tweaks) → **READY** (reconciled/edited)
→ **PUBLISHED** (final shareable snapshot, kept for history).

### Shape (sketch)
```
bills (one row = one whole bill)
  merchant, branch, datetime, currencyPrimary, rate, rateSource
  serviceCharge: 0, tax: 0, serviceChargeOn: false   // OFF by default
  printedTotalLbp?, printedTotalUsd?
  imageRef?, shareToken, status            // PENDING | READY | PUBLISHED
  lineItems: [{ id, name, qty, unitPrice, lineTotal, confidence }]
  people:    [{ id, name, color }]         // starts with "self"
  claims:    [{ itemId, personId, units }] // unit-by-unit, NOT equal fractions
```
- `id`s are **client-generated strings inside the document** (no Convex `Id` juggling).
- Arrays are validated with `v.object`/`v.array` — still end-to-end typed, just denormalized.
- Two mutations replace all CRUD: **`saveWorking({ id, lineItems?, people?, claims?, meta? })`**
  (the debounced flush) and **`publish({ id })`**.
- Editing in local state means the **optimistic-update layer in `queries.ts` is removed**.
- Split math becomes **`person share = Σ claimed_units × unitPrice`** (rework `split.ts`).

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

- **True real-time, multi-writer guest-claim** (several people claiming their own items live,
  each tap a conflict-free row). With a single JSON doc, concurrent editors are last-write-wins.
  Acceptable because **one person runs the bill** in practice; viewers are read-only.

## To research / revisit before it can improve

- **Live multi-person claim (Phase 2):** if we ever want it, options to research — re-normalize
  just the `claims` into rows then; or per-person sub-documents; or a CRDT / OT layer; or accept
  last-write-wins with presence hints. Decide which is least disruptive given this doc model.
- **Debounce/flush strategy:** interval vs idle vs flush-on-`blur`/`visibilitychange`/`beforeunload`
  and on route change, so nothing is lost when leaving mid-edit.
- **Local persistence & offline:** mirror working state to `localStorage` for refresh-safety and
  true offline-at-the-table; reconcile/sync on reconnect. Define the merge rule.
- **Server-push vs local edits:** while the editor is "dirty," don't let an incoming subscription
  push clobber in-progress local state; load-once-then-local-owns. Nail this pattern down.
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
