# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Billy** — a mobile-first Receipt Splitter for Lebanon's dual-currency (LBP/USD) reality:
photograph a receipt, a vision-LLM extracts the line items, the bill is reviewed in both
currencies at the venue's actual rate, a group splits it item-by-item, and per-person totals
are shared via a live link. The product is implemented end-to-end
(scan → review → split → publish → guest join); this is no longer the Trellaux starter.

Root docs, in reading order:
- `README.md` — detailed file-by-file guide and main flows.
- `receipt-splitter-build-spec.md` — product spec (concept, currency logic, split rules).
  Its §7 tech-stack table is outdated: it says Supabase + React/Vite; the real stack is
  **Convex + TanStack Start + Tailwind v4 + shadcn/ui**, deployed to Cloudflare.
- `architecture-decision.md` — bill storage model: stable parts embedded in one document,
  high-churn `claims` in their own table (see §Revisited 2026-07-06 for the cost math).

## Commands

```bash
pnpm install          # pnpm is the package manager
pnpm dev              # convex dev --once, then concurrently Vite (localhost:3000) + convex dev
pnpm dev:web          # Vite only
pnpm dev:db           # convex dev only
pnpm build            # vite build && tsc --noEmit — this is also the typecheck
pnpm deploy           # build, then wrangler deploy to Cloudflare (dist/server/wrangler.json)
pnpm cf-typegen       # wrangler types
npx convex dev        # provision/connect your own Convex backend (writes VITE_CONVEX_URL)
npx convex env set NAME value   # backend secrets — never in client code
```

- **No lint or test setup**, no test runner. "Typecheck" = `pnpm build` (or `tsc --noEmit`).
  Don't invent test/lint commands.
- `VITE_CONVEX_URL` must be set (see `.env.local.example`).
- Extraction needs Convex env vars: `GEMINI_API_KEY` (or `CF_AIG_TOKEN`),
  `CF_AIG_ACCOUNT_ID`, `CF_AIG_GATEWAY`, optional `GEMINI_MODEL`.

## Architecture

### Data model: bill document + claim rows

`bills` table (`convex/schema.ts`) holds the **stable, bounded** parts as embedded arrays —
`lineItems`, `people`, meta — while **`claims` is its own table** (one row per (item, person)
pair, `by_bill` index): claims are high-churn, and embedding them meant every tap rewrote the
whole document and contended on it (rationale + cost math in `architecture-decision.md`
§Revisited 2026-07-06). All claim-row access goes through the `convex/bills/claimRows.ts`
seam (read, wire mapping, keyed row-diff sync); claim mutations do **not** touch the bill doc
(no version bump). Queries assemble `{ ...bill, claims }`, so the frontend still sees one
bill object. Embedded entities and claim `itemId`/`personId` use client-generated string ids
(`src/lib/bill/ids.ts`), not Convex ids. Reusable validators/types are derived from the table
validators in `convex/schema.ts` and shared via `convex/bills/validators.ts`.

**Rule for new data:** stable + bounded + bill-scoped → embed in the bill; high-churn,
unbounded, or shared across bills (venues, table sessions, menu priors, reports) → own table
with an index.

Status lifecycle: `PENDING → NEEDS_REVIEW → READY → PUBLISHED → FINALIZED`. Successful
extraction lands on `PENDING` (or `NEEDS_REVIEW` on checksum/confidence failure); `READY` is
set by `saveWorking` once the user has reviewed.

### Convex + TanStack wiring (push-based reads)

Three layers joined by `@convex-dev/react-query`: TanStack Start (SSR + file routes),
TanStack Query (client cache), Convex (reactive backend). The adapter makes TanStack Query
*push*-based: passing a `convexQuery(api.x.y, args)` factory to `useQuery`/`useSuspenseQuery`
fetches **and opens a live WebSocket subscription** — mutations anywhere cause Convex to push
fresh results; no `invalidateQueries`, no polling, `staleTime` is irrelevant. This is why the
live guest-claim feature is essentially free.

- `src/router.tsx` — creates the `ConvexQueryClient`, sets its `queryFn`/`queryKeyHashFn` as
  QueryClient defaults, wraps the app in `ConvexProvider`, and registers a global
  `MutationCache.onError` that toasts every mutation error (**don't toast per-mutation**).
- `src/queries.ts` — the single place for frontend Convex references: `billQueries.detail(id)`
  / `billQueries.byToken(...)` option factories for reads; `useConvexMutation` wrapped in
  `useMutation` for writes.
- Use `useSuspenseQuery` for a route's primary data (fetches during SSR); prefetch in loaders
  with `context.queryClient.ensureQueryData(...)`.
- Full detail in the `convex-best-practices` skill (`rules/tanstack-convex-architecture.md`).

### Local-first editing — no optimistic updates

Bill editing does **not** use per-field mutations or `.withOptimisticUpdate`.
`src/hooks/useBillEditor.ts` owns a working copy (items/people/meta — **not claims**) in
React state, mirrors dirty state to localStorage, and flushes it via a debounced
`saveWorking` mutation (flush on page-hide/unmount). Pure immutable transforms live in
`src/lib/bill/edits.ts`; `src/lib/bill/working.ts` maps Convex docs ↔ the editor's
`WorkingBill` shape. Copy this pattern for editor-like features. Claims are edited only
through the scoped claim mutations (`saveHostClaims`/`saveGuestClaims`/…) as row diffs;
`saveWorking` reconciles the claim rows server-side when items/people change.

### Extraction pipeline

**Constraint:** Convex queries/mutations cannot call external APIs (`fetch` unavailable) —
external calls MUST be Convex **actions**.

Flow: `ScannerHub` compresses the photo (`browser-image-compression`) → `createBill` →
`generateUploadUrl` → POST to Convex storage → `attachImageAndExtract` patches `imageRef` and
runs `internal.extraction.actions.extractReceipt` (internalAction) via
**`@convex-dev/action-retrier`** (`convex/lib/retrier.ts`: transient vision failures retry
with backoff; final failure lands in `onExtractionComplete`, which marks the bill failed and
deletes the image — `bills.extractionRunId` + the `by_extractionRunId` index map run → bill)
→ the action reads image bytes, calls **Gemini via Cloudflare AI Gateway**
(`convex/extraction/vision.ts`, swappable `callVisionModel` seam; prompt in
`convex/extraction/prompt.ts`) → `applyExtraction` (internalMutation) normalizes to LBP,
runs the arithmetic checksum (`src/lib/reconcile.ts`), flags low-confidence/implausible
items, sets `PENDING` or `NEEDS_REVIEW`, and deletes the image. Storage access goes through the
`convex/lib/imageStore.ts` seam (Convex storage today, R2 possible later).
Rationale/eval plan: `convex-best-practices` skill, `rules/extraction-pipeline.md`.

### Currency

`src/lib/currency.ts` is a pure module imported by **both** browser code and Convex functions.
**LBP is the internal unit of record**; USD is derived at display time via the bill's `rate`
(default 90,000, `deriveRate` computes the venue rate when both printed totals exist;
`rateSource` records `receipt`/`market`/`manual`). Never store converted amounts.

### Routes

`src/routes/`: `index.tsx` + `scan.tsx` (both render `ScannerHub`: capture, resume-last-bill,
recent scans from localStorage `billy:bill-history` via `src/lib/billHistory.ts`),
`review/$billId` (extraction review editor), `split/$billId` (host claim workspace),
`summary/$billId` (totals + publish/share link), `join/$shareToken` (guest view; localStorage
`guestSessionId`; guest mutations `joinSplit`/`addGuestPerson`/`saveGuestClaims` are
session-scoped, host writes are gated by status).

`src/routeTree.gen.ts` is **generated** — never edit by hand. Aliases: `~/*` → `src/*`,
`convex/*` → `convex/*`.

### Where code goes

- React state/lifecycle → hooks, routes, components.
- Pure bill transforms → `src/lib/bill/*`.
- Math shared by UI and backend → `src/lib/*` (`currency.ts`, `split.ts`, `reconcile.ts`).
- External API calls → Convex actions only; `convex/schema.ts` is the source of truth for
  persisted shape.

## Skills

`.claude/skills/` contains best-practice skills — consult the matching one before non-trivial
work in that area: `convex-best-practices` (incl. `rules/tanstack-convex-architecture.md`,
`rules/extraction-pipeline.md`), `tanstack-start-best-practices`,
`tanstack-router-best-practices`, `tanstack-query-best-practices`,
`tanstack-virtual-best-practices`, `make-interfaces-feel-better`.

For any other library/API/CLI question, fetch current docs via `ctx7` (see the global rule)
rather than relying on memory — `npx ctx7@latest docs <libraryId> "<question>"`.

## Conventions

- **shadcn/ui is installed**: `components.json`, primitives in `src/components/ui/`, built on
  `@base-ui/react` (not Radix), style `base-luma`, icons `@remixicon/react`, RTL enabled.
  Add new primitives via the shadcn CLI rather than hand-writing them.
- Tailwind v4 via `@tailwindcss/vite` (config in `vite.config.ts`, styles in
  `src/styles/app.css`); `cn` in `src/lib/utils.ts`; `motion` for animation; `react-hot-toast`
  for toasts (global error toast already wired — see router note above).
- React 19, TypeScript `strict`. Mutations validate args with `convex/values` `v.*`; bill
  references use `v.id('bills')`, embedded entities use their string ids.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
