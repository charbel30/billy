# Receipt Splitter — Build & Architecture Spec (Web App)

A mobile-responsive web app that scans a restaurant/store receipt, extracts the line items with a vision-LLM, shows every amount in both **LBP and USD**, and lets a group split the bill item-by-item into per-person "portfolios." Built for Lebanon's dual-currency reality.

> **Scope of this document:** the full plan — product concept, the key design decisions and *why*, system architecture, the extraction pipeline, currency logic, the split logic and data model, tech stack, app structure, privacy/legal, and error handling. Web-first, because it ships fastest and solves the "get everyone into the split" problem with a link instead of an install.

---

## 1. Product concept

**What it does**
1. One person photographs the receipt.
2. The app reads it into a structured table: item, quantity, price.
3. It shows the bill in **both LBP and USD**, using the rate the venue actually charged (most Lebanese receipts print both totals, so the rate is on the paper).
4. The group assigns items to people — including shared items. (optional for now we should make it that you can increase unit size to get total price for each person to get to the total when everything is added u correctly )
5. Service charge / tax / tip are distributed fairly.
6. Each person gets their own total in both currencies.
7. A shareable link lets friends see (and later claim) their part **without installing anything**.

**Who it's for**
- Friends splitting a restaurant bill in Lebanon.

**Why it's not "just another Splitwise"**
The gap no existing app fills: **LBP/USD dual display at a user-controllable parallel rate**, with receipts that are often English/French + occasionally Arabic. That intersection is the whole differentiator. Everything else (splitting, link-sharing) is table stakes that we copy from the best apps.

---

## 2. Core design decisions

These are the decisions that shape everything else. Lock these first.

### 2.1 Web app first (PWA), native later
- **Why web:** the killer requirement for a *splitter* is getting other people into the split. A link works for everyone; an install works for almost no one — and in Lebanon you cannot assume a whole table installs your app. Web also gives one codebase, no app-store fees or review, instant updates.
- **The tradeoff we accept:** browsers can't run the free on-device OCR kits (Apple Vision / ML Kit are native-only). But our MVP OCR is a **cloud vision-LLM call anyway**, so web loses nothing here — the image goes to the cloud either way.
- **When we'd add native:** only when on-device OCR becomes a real requirement — free, offline (Lebanon's flaky internet at scan time), and private (image never leaves the phone). At that point: **native app for the host, web link for guests.**

### 2.2 The receipt usually carries its own exchange rate
Most receipts here print **both** `TOTAL LL` and `TOTAL $`. That means the correct conversion rate is literally on the paper:

```
rate = total_lbp / total_usd
```

So for these bills we **don't need a live market-rate feed at all** — we use the rate the venue charged. We only fall back to a market rate when the receipt prints a single currency. (Always allow a manual override.)

### 2.3 Trust nothing without a checksum + a human glance
OCR/LLM extraction is good, not perfect, and people are paying real money. Two guardrails, always:
- **Arithmetic checksum:** sum of line items (+ service + tax) must reconcile to the printed total. If it doesn't, flag it.
- **Mandatory review screen:** the user confirms/edits the table before anyone splits anything.

### 2.4 No account required to start
A bill can be created and shared anonymously via an unguessable token. Logins/history are optional and come later. This removes the single biggest adoption barrier.

---

## 3. System architecture

The whole flow is a short, linear pipeline with a human checkpoint:

```
[Capture photo]            browser camera / file input, compress client-side
        |
        v
[Extract]                  Convex action → vision-LLM → structured JSON
        |
        v
[Reconcile]                checksum: items (+service+tax) ?= printed total
        |
        v
[Review & fix]   <-------- HUMAN: confirm/edit table, confirm rate
        |
        v
[Convert]                  derive rate from receipt (or market/manual) → LBP+USD
        |
        v
[Split]                    assign items to people, distribute service/tax/tip
        |
        v
[Share]                    read-only (Phase 1) → interactive claim link (Phase 2)
```

**Why this shape:** each stage is independently replaceable. We can swap the LLM provider, change the rate source, or upgrade the split logic without touching the rest. The human checkpoint sits exactly where errors are cheapest to fix.

---

## 4. The extraction pipeline (OCR/LLM)

### 4.1 Approach for the web MVP
Skip a separate OCR library entirely. A vision-capable LLM **reads and structures in one call**, handles English/French/Arabic and mixed numerals natively, and — critically — can **reason** (e.g. recover a quantity hidden by a finger using the printed total as a constraint). That reasoning step is the thing a plain OCR engine cannot do.

The call lives in a Convex **action** (queries/mutations can't `fetch`) so the API key — stored
in Convex env vars — never reaches the browser. The action persists the result via a mutation.

> Pick a current vision-LLM provider with structured-output / JSON support and good multilingual handling, and verify pricing per image at build time (this space and its prices move fast). Keep the provider behind one interface so it's swappable. A self-hosted vision model (e.g. a Qwen-VL-class model) is the privacy/cost alternative once volume justifies it. Add a server-side OCR fallback (PaddleOCR) only if Arabic receipts become frequent — you said they're rare today, so this is deferred.

### 4.2 Ask the model for strict JSON
Send the compressed image plus a schema. Example target shape:

```json
{
  "merchant": "Maison Zola",
  "branch": "Gemmayze, Beirut",
  "datetime": "2026-06-14T00:30:00",
  "currency_primary": "LBP",
  "line_items": [
    { "name": "Chivas 12Y Glass", "qty": 5, "unit_price": 1260000, "line_total": 6300000, "confidence": 0.97 }
  ],
  "service_charge": 0,
  "tax": 0,
  "printed_total_lbp": 19440000,
  "printed_total_usd": 216.00
}
```

**Prompt rules to bake in:**
- Use `printed_total_*` as a constraint. If a quantity is illegible or occluded, infer it from `line_total` and the totals, and **lower its `confidence`**.
- **Never invent or "correct" a price** that is legible. If unsure, flag low confidence — do not silently change it.
- Return numbers as plain integers/decimals (no thousands separators, no currency symbols).
- If only one currency total is printed, leave the other null.

### 4.3 Reconcile (the free safety net)
After parsing:

```
computed = sum(line_total) + service_charge + tax
if abs(computed - printed_total_lbp) > tolerance:
    mark bill as NEEDS_REVIEW (highlight the mismatch)
```

This single check catches most extraction and occlusion errors before they reach the split.

### 4.4 Always show the review screen
- Render the table editable.
- Highlight any field with `confidence < threshold` or any reconciliation mismatch.
- Offer inline edit, add-item, delete-item, fix-quantity.
- Provide a **manual-entry fallback** ("type the bill instead") for when a photo fails completely.

---

## 5. Currency logic

```
if printed_total_lbp and printed_total_usd:
    rate = printed_total_lbp / printed_total_usd      # venue's own rate
    rate_source = "receipt"
elif market_rate_available:
    rate = cached_market_rate                          # parallel/market feed
    rate_source = "market"   (show "as of <timestamp>")
else:
    rate = user_input
    rate_source = "manual"

# user can override at any time -> rate_source = "manual"
```

**Storage principle:** store every amount in its **original currency** plus the **rate used** and the **rate source**. Then the other currency is always reproducible and auditable; you never lose the source of truth to rounding. Display both currencies everywhere, with the rate and its source visible.

**Market-rate fallback (Phase 2):** a daily Convex cron runs an action that pulls a parallel-rate source and caches it in a table with a timestamp. Default to it only when the receipt doesn't carry both totals.

---

## 6. Split logic & data model

### 6.1 Rules
- Every line item is assigned to **one or more** people.
- A **shared** item splits equally among its assignees by default, or by explicit fractions.
- Each person's **subtotal** = sum of their item shares.
- **Service charge / tax / tip** are distributed **proportionally** to each person's subtotal by default (the fair norm; Lebanese restaurants typically add service). Offer an **even-split** toggle.
- Person total is shown in **both currencies** at the bill's rate.

### 6.2 Data model (Convex tables)

Defined in `convex/schema.ts` with `defineTable` + indexes. Every doc gets system fields `_id`
(`Id<'table'>`) and `_creationTime` for free — don't redefine them. Use `v.id('bills')` for
foreign keys (type-safe references), and add an index per relation so children are fetched with
`.withIndex()` instead of a full-table `.filter()` scan.

```
users            (optional — guests can be anonymous)
  displayName, email?
  // _id, _creationTime come for free

bills
  ownerId?: Id<'users'>, merchantName, branch, datetime,
  currencyPrimary, rate, rateSource,             -- "receipt" | "market" | "manual"
  serviceCharge, tax,
  printedTotalLbp?, printedTotalUsd?,
  imageStorageId?: Id<'_storage'>,               -- null by default (privacy)
  shareToken,                                    -- unguessable, expirable
  status,                                         -- DRAFT | NEEDS_REVIEW | READY | SHARED
  .index('by_share_token', ['shareToken'])

lineItems
  billId: Id<'bills'>, name, qty, unitPrice, lineTotal,
  currency, confidence
  .index('by_bill', ['billId'])

people                                            -- participants, not necessarily app users
  billId: Id<'bills'>, name, color
  .index('by_bill', ['billId'])

assignments
  lineItemId: Id<'lineItems'>, personId: Id<'people'>, shareFraction  -- supports shared items
  .index('by_line_item', ['lineItemId'])
  .index('by_person', ['personId'])
```

Per-person totals are **computed**, not stored — derive them in a Convex query from the
assignments so they're always consistent (and update live as people claim items). Persist a
snapshot only if you later need an immutable settled record.

---

## 7. Tech stack

> **Note:** this section records the original plan. The app as built uses TanStack Start, Convex and Cloudflare Workers; see the [README](../README.md#tech-stack) for the current stack.

Chosen for "ship a working thing fast, cheap, on free tiers." This is the **actual** stack the
project is built on (it supersedes earlier Supabase/Vite proposals).

| Layer | Choice | Why |
|---|---|---|
| Framework | **TanStack Start** (full-stack React 19, Vite-powered, SSR + file-based routing) | One codebase, type-safe routing/loaders, server rendering for fast mobile first paint |
| Routing / data | **TanStack Router** + **TanStack Query** via `@convex-dev/react-query` | Type-safe routes; Convex queries become live-updating TanStack Query option factories |
| UI | **Tailwind v4** (`@tailwindcss/vite`) + **shadcn/ui** | Utility CSS + accessible, ownable component primitives; great mobile UX |
| PWA | `vite-plugin-pwa` (Phase 2) | Install-to-home-screen, camera, some offline caching |
| Capture | `<input type="file" accept="image/*" capture="environment">` + `getUserMedia`; client-side compression (`browser-image-compression`) | Works in every mobile browser; shrink image before upload |
| Backend | **Convex** (reactive document DB + serverless TS functions + file storage) | Real-time bill data, live queries over WebSocket, automatic query invalidation, end-to-end types, share tokens |
| Extraction | Vision-LLM via a Convex **action** (key in Convex env vars, server-side) | Actions are the only function type that can `fetch`; one call reads + structures + reasons |
| FX (Phase 2) | Convex **cron** → action → parallel-rate source → cached row | Only needed when receipt lacks both totals |
| Hosting | Frontend on **Vercel/Netlify** (or any TanStack Start adapter) + **Convex** (managed backend) | Generous free tiers, zero ops |
| Payments | **None in MVP** | Stays a calculator → avoids fintech licensing |

> **Convex vs. the spec's earlier language:** where older sections say "edge function," read
> "Convex action"; "Postgres table" → "Convex table"; "row-level security" → Convex function
> auth checks + unguessable share tokens. Convex queries/mutations **cannot** call external
> APIs — only **actions** can — so all OCR/FX network calls live in actions.

---

## 8. App structure

### 8.1 Routes / screens

| Route | Screen | Notes |
|---|---|---|
| `/` | New bill / landing | Start a scan or manual entry |
| `/scan` | Capture | Camera or file pick → compress → upload |
| `/review/:billId` | Review & fix | Editable table, confidence highlights, rate confirm |
| `/split/:billId` | Assign | Add people, tap items to assign, shared-item handling |
| `/summary/:billId` | Portfolios | Per-person totals, both currencies, service distribution |
| `/b/:shareToken` | Guest view | Read-only (Phase 1) → interactive claim (Phase 2), no login |
| `/history` | History | Optional, logged-in only |

### 8.2 Suggested folders

TanStack Start frontend in `src/`, Convex backend in `convex/`.

```
src/
  routes/             # file-based routes = the screens above (__root.tsx, index.tsx, ...)
  components/
    ui/               # shadcn/ui primitives (button, input, dialog, ...)
    ReceiptTable/     # editable line-item table
    CurrencyToggle/   # LBP <-> USD display
    PersonChips/      # people + colors
    AssignGrid/       # item-to-person assignment UI
    ReconcileBanner/  # checksum mismatch warning
  queries.ts          # convexQuery option factories + useConvexMutation hooks (TanStack Query)
  router.tsx          # ConvexQueryClient + QueryClient + ConvexProvider wiring
  lib/
    reconcile.ts      # checksum logic (pure, client+server reusable)
    currency.ts       # rate derivation, conversion, formatting
    split.ts          # per-person totals, proportional service/tax
convex/
  schema.ts           # the data model in section 6.2 (defineSchema/defineTable + indexes)
  bills.ts            # queries + mutations for bills/line-items/people/assignments
  extract.ts          # action: image -> vision-LLM -> JSON, then mutation to persist
  fx.ts               # action: market-rate fetch (Phase 2)
  crons.ts            # scheduled jobs: FX refresh, image-TTL purge (Phase 2)
```

> Pure logic (`reconcile`, `currency`, `split`) stays framework-agnostic in `src/lib/` so it can
> run in the browser for instant feedback and be imported by Convex functions for server-side
> checks. There are no migrations — Convex derives the schema from `convex/schema.ts`.

---

## 9. Key flows

### 9.1 Scan & split (host)
1. `/scan` → take photo → compress → upload to Convex storage → call the `extract` action.
2. Action calls vision-LLM → returns JSON → `reconcile.ts` sets status via a mutation.
3. Redirect to `/review/:billId`; user confirms/edits; rate auto-derived from receipt.
4. `/split/:billId`: add people, tap items onto people, mark shared items.
5. `/summary/:billId`: per-person totals in both currencies; share link generated.

### 9.2 Guest claim (Phase 2)
1. Host shares `/b/:shareToken`.
2. Guest opens link (no install, no login), sees the items.
3. Guest taps the items that were theirs; totals update live.
4. Host sees everyone's portfolio fill in.

---

## 10. Privacy, legal & security

- **Cloud OCR = the image leaves the device.** Be explicit about it. **Don't store the image by default** — process and discard. If you must keep it (e.g. for re-review), store in Convex file storage with a short TTL (enforced by a cron) and gate access behind function auth checks, and let the user delete it.
- **Lebanon Law No. 81/2018** governs personal data and can require a **prior declaration to the Ministry of Economy and Trade** for processing personal data; there's no independent regulator. Minimize what you collect; anonymous bills + no stored images keeps exposure low. Confirm current obligations before launch.
- **Stay a calculator.** No money movement in the MVP → no BDL/AML fintech licensing. If you ever add settlement/payments, the regulatory picture changes materially.
- **Share tokens:** unguessable (UUID/secure random), expirable, revocable. A leaked token must not expose more than that one bill.
- **Don't store card data.** (These receipts don't carry it, but enforce it anyway.)
- Publish a short, honest privacy policy describing the cloud-processing step.

---

## 11. Accuracy & error handling

- **Checksum reconciliation** on every extraction (section 4.3).
- **Confidence highlighting** on low-confidence and inferred fields.
- **Inline edit** everywhere; never a dead end.
- **Manual-entry fallback** when a photo fails.
- **Occlusion honesty:** if a quantity genuinely can't be resolved (e.g. only the line total is printed and the qty is hidden), surface it as a question to the user rather than guessing silently.

---

## 12. Open decisions to settle before building

1. **Offline at the table:** is "scan with no internet" a must-have? If yes, that pulls native forward (cloud-web can't scan offline). If "there's usually wifi/data" is acceptable, web MVP stands.
2. **LLM provider:** hosted vision-LLM (simplest) vs self-hosted (cheaper/private at scale). Start hosted, keep it swappable.
3. **Store images or not:** default no. Decide if any re-review feature is worth the privacy cost.
4. **Accounts:** anonymous-only for MVP, or optional login from day one for history?

---

## Appendix A — Worked example (the Maison Zola receipt)

Rate derived from the receipt: `19,440,000 / 216 = 90,000 LBP/USD`. Items reconcile exactly to the printed total (checksum passes).

| Qty | Item | LBP | USD @ 90,000 |
|----|------|----:|----:|
| 1 | Captain Morgan White | 1,260,000 | 14.00 |
| 5 | Chivas 12Y Glass | 6,300,000 | 70.00 |
| 1 | Almaza – 33cl | 540,000 | 6.00 |
| 3 | Water Btl Small | 810,000 | 9.00 |
| 1 | Mini Burger Bonbon | 2,070,000 | 23.00 |
| 1* | Diet Pepsi | 360,000 | 4.00 |
| 1* | Diet Seven Up | 360,000 | 4.00 |
| ?* | Water Btl Large | 900,000 | 10.00 |
| 1 | Passion Fruit Martini | 1,260,000 | 14.00 |
| 3 | Midori Sour MZ | 3,780,000 | 42.00 |
| 2 | Satyr White Glass | 1,800,000 | 20.00 |
| | **TOTAL** | **19,440,000** | **216.00** |

\* Quantities that were occluded in the photo: inferred from price where unambiguous (Diet Pepsi/7Up = 1), flagged for user confirmation where not (Water Btl Large — 1×900k vs 2×450k can't be resolved from the image). This is exactly the case the review screen exists for.

## Appendix B — One-line architecture summary

> **Browser camera → compress → backend vision-LLM (read + structure + reason) → checksum → human review → rate from receipt → assign items → proportional service → per-person totals in LBP & USD → shareable link.**
