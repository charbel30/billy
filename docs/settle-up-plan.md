# Settle-up Layer — ROADMAP Phase B / IDEAS §1

> **Revised 2026-07-06** after the claims-table refactor (`architecture-decision.md`
> §Revisited): claims now live in their own `claims` table and `saveWorking` no longer
> accepts a `claims` arg. This plan is unaffected in substance — `paidAt` sits on the
> **embedded `people` array** (low-churn: at most one write per person per bill, so it
> stays in the document per the embed-vs-row rule) and `paymentNote` on the bill doc.
> All design decisions and the wipe-hazard reasoning below still hold as written.

## Context

The app currently ends at the wrong moment: `BillSummary` shows per-person totals, finalize makes the bill read-only, and there is no way to track who actually paid. This is the biggest product gap identified in IDEAS.md §1 and a Phase B checklist item in ROADMAP.md (§7): **mark-as-paid per person, host payment note, settle progress** — plus the cash-friendly rounding view. Still a calculator: no money movement, display-only math. Docs updates are part of the deliverable.

No `paid`/`settle`/`paymentNote` concept exists anywhere today (verified by exploration).

## Key design decisions

- **D1 — mark-paid gated to `PUBLISHED | FINALIZED`** via a new `assertSettleOpen` guard (settling happens after sharing, and keeps working after FINALIZE — unlike claims, which stay locked). This also closes a data-loss race: `saveWorking` ignores submitted people while PUBLISHED and no-ops while FINALIZED, so a stale review-editor flush can never wipe `paidAt`. Do **not** loosen `assertSharedForGuestWrites`.
- **D2 — payment note is a bill-level field with a dedicated `setPaymentNote` mutation**, NOT the `metaValidator`/`saveWorking` meta path: the host must edit it from the summary screen even after FINALIZED (`saveWorking` hard-returns on FINALIZED), and keeping it out of `metaValidator`/`WorkingMeta` means the editor can never clobber it.
- **D3 — `paidAt` must be added to the `sanitizeWorkingBill` person whitelist** (`src/lib/bill/working.ts:41-46`) or any host save on a non-published bill (e.g. after `revokeShare` drops it to READY) silently strips it.
- **D4 — guest UI placement**: PUBLISHED guests see `BillSplitWorkspace`; reuse its `panelExtra` slot (`join/$shareToken.tsx:201` — currently `null` once joined) for a "Settle up" card. FINALIZED guests see `BillSummary`; add toggles there via `canTogglePaid`.
- **D5 — cash view lives inside `BillSummary`** (local `useState`, display-only, never stored) so host summary and guest FINALIZED view both get it. Rounding helper in `src/lib/currency.ts`. Notes 50k/100k, default 100k.
- **D6 — settle denominator = people who owe something** (`totalLbp > 0`); a person with nothing claimed has nothing to settle.
- `paidAt` is self-reported social signal, not accounting — render as a checkmark, don't display the timestamp as authoritative.

## Step 1 — Schema + shared types

- `convex/schema.ts` — add to `person` validator (~line 56): `paidAt: v.optional(v.number())` (ms timestamp; guest marks self, host marks anyone). Add to `bills` table: `paymentNote: v.optional(v.string())`. Both optional → no migration.
- `convex/bills/validators.ts` — add `paymentNote` to `billDocValidator` (person element flows automatically via import). Do **not** touch `metaValidator`.
- `src/lib/types.ts` — `Person` gains `paidAt?: number`.
- `src/lib/bill/working.ts` — in `sanitizeWorkingBill` people map: `...(p.paidAt != null ? { paidAt: p.paidAt } : {})`. Leave `WorkingMeta`/`workingBillFromDoc` alone.

## Step 2 — Mutations (`convex/bills/mutations.ts`)

New guard next to `assertSharedForGuestWrites` (~line 150):

```ts
function assertSettleOpen(bill) {
  if (bill.status !== 'PUBLISHED' && bill.status !== 'FINALIZED')
    throw new Error('This split has not been shared yet')
}
```

Shared helper `withPersonPaid(people, personId, paid)` — maps people; on unmark, rest-destructures `paidAt` out (never store `undefined` in the array); on mark, `paidAt: p.paidAt ?? Date.now()` (idempotent under double-taps).

Three mutations (all bump `version` + `updatedAt`, naming matches existing `addHostPerson`/`saveGuestClaims`):

1. `setHostPersonPaid` — args `{ id: v.id('bills'), personId: v.string(), paid: v.boolean() }`. Guards: bill exists, `assertSettleOpen`, person exists.
2. `setGuestPersonPaid` — args `{ shareToken, guestSessionId, personId, paid }`. Guards in order: `assertGuestSessionId`, `getBillByShareToken`, `assertSettleOpen`, person exists, ownership `person.guestSessionId === guestSessionId` (same error text as `saveGuestClaims`). No rate limiter — ownership-scoped, same as `saveGuestClaims`.
3. `setPaymentNote` — args `{ id: v.id('bills'), paymentNote: v.string() }`. No status guard (same billId-capability trust model as `finalize`; works pre-publish and post-finalize). Trim + cap at ~200 chars; empty string clears via `ctx.db.patch(id, { paymentNote: undefined })` (confirm unset semantics against `convex/_generated/ai/guidelines.md` during implementation).

## Step 3 — Pure helpers

- `src/lib/split.ts` — `computeSettleProgress(people, portfolios): { settledCount, owingCount, outstandingLbp }` (owing = `totalLbp > 0`; settled = `paidAt != null`; outstanding = Σ totalLbp of unpaid owing people). Don't touch the private `roundToTarget`.
- `src/lib/currency.ts` — `CASH_NOTES_LBP = [50_000, 100_000]`; `roundToNote(lbp, noteLbp): { roundedLbp, driftLbp }`; `formatLbpDrift(driftLbp)` → `"+2,700 LL"` / `"−2,700 LL"` / `""`.

## Step 4 — Client hooks (`src/queries.ts`)

`useSetHostPersonPaid`, `useSetGuestPersonPaid`, `useSetPaymentNote` — thin `useMutation({ mutationFn: useConvexMutation(...) })` wrappers in the established pattern. No optimistic updates, no per-mutation toasts (global `MutationCache.onError` is wired).

## Step 5 — Shared UI components

- `src/components/bill/PortfolioReceipt.tsx` — new **optional** props (defaults off so PersonRail/MobileSplitSheet compile unchanged): `paidAt?` (static emerald "Paid ✓" chip in header row ~33-36), `onTogglePaid?` (chip becomes a toggle button "Mark paid" ↔ "Paid ✓", `disabled={togglePending}`), `togglePending?`, `cashNoteLbp?` (LBP line on the Total row becomes `≈ {formatLbp(rounded)}` + muted drift; USD headline untouched).
- `src/components/bill/BillSummary.tsx` — new optional props: `onTogglePaid?(personId, paid)`, `canTogglePaid?(personId)`, `paidPendingId?`, `showSettleProgress?`, `enableCashView?`. Reads `paidAt` off `bill.people` (map by id). Settle line under the title when owingCount > 0: `"{settled} of {owing} settled · {formatLbp(outstanding)} still out"` (+ an all-settled state). Cash view: Switch + 50k/100k `toggle-group`, passes `cashNoteLbp` to each receipt.
- New `src/components/bill/PaymentNoteCard.tsx` — `{ note, onSave? }`: editable mode (host) = card with `Textarea` (`src/components/ui/textarea.tsx` exists), commit-on-blur (mirror the `BlurCommitInput` draft/blur pattern), placeholder `"Cash to me, or Whish 03 123 456"`; read-only mode (guest) = compact "💸 How to pay" card, renders nothing when note empty.

## Step 6 — Route wiring

- **Host `src/routes/summary/$billId.tsx`** (the settle screen): wire `useSetHostPersonPaid` + `useSetPaymentNote`; `BillSummary` gets `onTogglePaid` (only when `shared`), `showSettleProgress={shared}`, `enableCashView`, `paidPendingId` from the pending mutation's variables. `PaymentNoteCard` with `onSave` between `BillSummary` and the share-text button (always rendered — note may be set pre-publish).
- **Guest `src/routes/join/$shareToken.tsx`**:
  - FINALIZED branch (lines 179-190): `BillSummary` gets `showSettleProgress`, `enableCashView`, `onTogglePaid` → `setGuestPersonPaid.mutate({ shareToken, guestSessionId, personId, paid })`, `canTogglePaid={(id) => controlledPeople.some(p => p.id === id)}`; read-only `PaymentNoteCard` above it.
  - PUBLISHED branch: when `joined`, `panelExtra` (line 201, currently `null`) becomes a compact "Settle up" card — per controlled person: name + total (one `computePortfolios` call in the route) + "I've paid" toggle; plus read-only `PaymentNoteCard` when `bill.paymentNote` is set. Keep compact — it renders inside the mobile dock too.
- **Read-only paid badges elsewhere** (cheap, one prop per site): pass `paidAt` into the `PortfolioReceipt` instances in `PersonRail.tsx` (~line 138) and `MobileSplitSheet.tsx` (~line 108). No interactive toggles on the split screen — summary is the settle surface.

## Step 7 — Share text (`src/lib/shareText.ts`)

`TotalsMessageBill` gains `paymentNote?`. Per-person lines get `" ✅"` when paid. After the `Total:` line, when note non-empty: blank line + `Pay: {note}` — before the join-URL line.

## Step 8 — Docs (part of the deliverable)

- `ROADMAP.md` §7 Phase B: flip the settle-up item to `[x]` with a short shipped note (style of the Phase A lines); update the §Status header note if appropriate.
- `IDEAS.md` §1: add a "**Status: shipped 2026-07-06**" note (paidAt on person, three mutations, settle progress + cash view on BillSummary; venue seat-view remains future); update the §8 phase-mapping table row.

## Suggested commit sequence

1. Backend: schema + validators + types + sanitize whitelist + 3 mutations + guard (`pnpm build` green standalone).
2. Pure helpers (`computeSettleProgress`, `roundToNote`, drift format) + shareText.
3. Hooks + PortfolioReceipt/BillSummary/PaymentNoteCard + route wiring.
4. Docs.

## Verification (no test runner — `pnpm build` + manual via `pnpm dev`)

1. `pnpm build` (vite build && tsc --noEmit) passes.
2. Create the **demo bill** (zero Gemini cost) → claim items → publish.
3. Incognito join → guest joins → "Settle up" card appears; host sets payment note on `/summary` → appears live on guest without refresh.
4. Guest taps "I've paid" → live checkmark on host summary + progress updates; unmark reverts.
5. Guest cannot toggle others (chip hidden via `canTogglePaid`; direct mutation rejected by ownership check).
6. Host toggles anyone from `/summary`; finalize → guest FINALIZED view still shows note + progress and can still toggle self; claims stay locked.
7. Cash view: 50k vs 100k rounding, signed drift, off restores exact LBP.
8. "Share totals as text" includes ✅ on paid people and the `Pay:` line.
9. **Wipe-hazard regressions**: PUBLISHED bill with paid people → edit line items on `/review` (`saveWorking`) → `paidAt` survives; then `revokeShare` → READY → edit again → survives (sanitize whitelist); mark-paid on READY bill is rejected.
10. Old bills without the new fields load fine on all routes.
