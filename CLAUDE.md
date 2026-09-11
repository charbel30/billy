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
- `ux-flow-and-motion-plan.md` — decided (2026-09-11), not yet implemented: the shared dock
 shell + header across bill screens, the full-screen scan processing state owned by review,
 view-transition step navigation + gating, and the summary→settlement redesign. Phased A–E;
 pick up a phase from there rather than re-deciding it.

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

Refactored 2026-07-07 to a **feature-module layout** (decided over route-colocation and
plain type-first layering). The rules below are the contract — put new code where the
structure says it goes, don't drift back to dumping files at the top of `components/`,
`lib/`, or a single mutations file.

### Directory contract

```
convex/
├── bills/            # public bill functions, split by CALLER then domain — Convex file
│   ├── host/         # path = api namespace, so these files ARE the public API:
│   │                 #   lifecycle.ts (create/save/publish/finalize/revoke/tip),
│   │                 #   people.ts, claims.ts, uploads.ts, queries.ts
│   │                 #   → api.bills.host.<file>.*  (host writes, gated by bill id)
│   ├── guest/        #   people.ts (join/add/mark-paid), claims.ts, queries.ts
│   │                 #   → api.bills.guest.<file>.* (shareToken + guestSessionId scoped)
│   ├── extraction.ts # applyExtraction (internal only)
│   └── lib/          # registers NO functions (so no api namespace):
│                     #   functions.ts — custom function builders (convex-helpers): every
│                     #   public bills function registers through one; new cross-cutting
│                     #   concerns (auth, roles, limits, transformations) go in the builders
│                     #   validators.ts — reusable v.* validators derived from schema
├── model/            # plain-TS helpers (no registered functions) — public functions are
│   │                 # THIN wrappers that call into here (official Convex pattern):
│   │                 # bills.ts (gates/validation/claim math), claimRows.ts (claims-table seam)
├── extraction/ lib/ schema.ts crons.ts
src/
├── api/              # THE ONLY place that touches convex/_generated/api:
│   │                 # billQueries.ts (option factories), billMutations.ts (hooks),
│   │                 # uploads.ts, index.ts. Convex file renames only ever touch src/api/.
├── routes/           # THIN: createFileRoute + loader (+ head) + <FeaturePage/>; no logic
├── components/
│   ├── ui/           # generic, domain-free controls: shadcn primitives (CLI-added) +
│   │                 # hand-rolled generics (animated-amount, blur-commit-input) — kebab-case
│   ├── shared/       # cross-feature app chrome: AppHeader, Loader, NotFound,
│   │                 # DefaultCatchBoundary, LegalFooter
│   └── features/
│       ├── scan/ review/ split/ summary/ join/   # one folder per screen/feature, uniform:
│       │                 #   <Feature>Page.tsx (the ONLY file routes/other features import),
│       │                 #   components/ (feature-private pieces), hooks/, content.ts (copy)
│       └── bill/     # bill-domain components used by ≥2 features, in 5 clusters each with
│                     # a barrel index.ts: claims/ people/ receipt/ workspace/ summary/
│                     # + top index.ts = the surface other features import
├── hooks/            # cross-feature hooks only (useBillEditor, useOfflineIndicator)
├── lib/              # pure logic, no React — grouped, each folder has a barrel index.ts:
│   ├── money/        # currency.ts, split.ts, reconcile.ts — imported by convex, keep pure
│   ├── bill/         # bill domain: types, edits, working, storage, ids, constants, claims…
│   ├── format/       # format.ts, number.ts, shareText.ts
│   ├── session/      # deviceId.ts, guestSession.ts, billHistory.ts — future auth-session home
│   ├── ui/           # animations.ts (motion presets), haptics.ts, theme.ts, appContent.ts
│   └── types.ts utils.ts invariant.ts seo.ts   # root: canonical domain types, cn(), misc
```

**Barrel/import rules:** components keep their real PascalCase filenames; each cluster/group
folder exposes a small `index.ts` barrel. Consumers outside a folder import the barrel
(`~/lib/money`, `~/components/features/bill`); files inside a cluster import siblings
relatively; clusters inside `features/bill/` import each other via the sibling cluster's
barrel (`../people`) and NEVER import the top `features/bill/index.ts` (cycle risk).
convex/ imports shared `src/lib` modules by CONCRETE file path (e.g. `src/lib/money/currency`),
never via a barrel, so backend code can't accidentally pull in React.

**Auth-readiness:** when roles/auth land, identity checks extend the builders in
`convex/bills/lib/functions.ts` (handlers stay unchanged), server-side user data gets its own
`convex/users/` domain, client session helpers live in `src/lib/session/`, and the new api
namespace gets its own file in `src/api/`.

**Learnings baked into this layout (don't undo them):**
- One 800-line `mutations.ts` was the biggest pain point → function files map 1:1 to
  `api.bills.<caller>.<domain>.*`; keep each new mutation in the file matching its caller
  (host/guest) and domain, and keep non-function plumbing out of namespace folders.
- Components >~300 lines always hid extractable pieces (ScannerHub had 5, the review route
  had 9). When a file grows an inner `function Foo()` component, give it its own file in the
  same feature folder immediately.
- Duplication happened across routes (`claimsForPerson`/`unitsFor` existed twice) because
  there was no obvious shared home — pure helpers go in `src/lib/`, never in a route/page.
- Constants live in constants modules, not inline: bill-domain rules in
  `src/lib/bill/constants.ts` (shared with convex — MAX_PEOPLE, tip bounds, TIP_PRESETS),
  feature copy/labels in the feature's `content.ts`, motion presets in `src/lib/ui/animations.ts`.
- Naming: components `PascalCase.tsx`; everything else `camelCase.ts`; `components/ui/`
  stays kebab-case (shadcn convention).
- A component is "ui/" only if it has zero domain knowledge; bill-domain but multi-feature →
  `features/bill/`; single-feature → that feature's folder.

### Data model: bill document + claim rows

`bills` table (`convex/schema.ts`) holds the **stable, bounded** parts as embedded arrays —
`lineItems`, `people`, meta — while **`claims` is its own table** (one row per (item, person)
pair, `by_bill` index): claims are high-churn, and embedding them meant every tap rewrote the
whole document and contended on it (rationale + cost math in `architecture-decision.md`
§Revisited 2026-07-06). All claim-row access goes through the `convex/model/claimRows.ts`
seam (read, wire mapping, keyed row-diff sync); claim mutations do **not** touch the bill doc
(no version bump). Queries assemble `{ ...bill, claims }`, so the frontend still sees one
bill object. Embedded entities and claim `itemId`/`personId` use client-generated string ids
(`src/lib/bill/ids.ts`), not Convex ids. Reusable validators/types are derived from the table
validators in `convex/schema.ts` and shared via `convex/bills/lib/validators.ts`. Mutation
handlers stay thin: shared validation/gates/claim math live in `convex/model/bills.ts`
(`assertEditableSplit`, `assertSettleOpen`, `saveClaimsForPerson`, …) — reuse those, don't
re-implement checks inline. Identity + status gating is applied by the **custom function
builders** in `convex/bills/lib/functions.ts` (convex-helpers `customMutation`/`customQuery`):
`billMutation`/`editableBillMutation`/`settleBillMutation` consume `id`+`hostToken` and inject
`ctx.bill` (**host writes need the bill's `hostToken`, not just its id** — the id is in the URL;
the token is minted server-side by `createBill`, returned once, and stored per-bill in
localStorage by `src/lib/session/hostToken.ts`; no query ever returns it);
`guestMutation`/`guestSettleMutation` consume `shareToken`+`guestSessionId`, gate by status,
and inject `ctx.bill`+`ctx.guestSessionId`; `deviceLimitedMutation(limit, msg)` consumes
`deviceId` and charges the per-device rate limit; `billQuery`/`sharedBillQuery` do the same
for reads. Register new public bills functions through the matching builder, never with raw
`mutation`/`query` — and put new cross-cutting concerns (auth, transformations) in the
builders, not in handlers.

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
- `src/api/` — the single place for frontend Convex references: `billQueries.detail(id)`
  / `billQueries.byToken(...)` option factories for reads (`billQueries.ts`);
  `useConvexMutation` wrapped in `useMutation` for writes (`billMutations.ts`, `uploads.ts`).
  Import from `~/api`; never call `api.*` from a component/route directly.
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

Flow: the landing page's `ScanReceiptActions` confirms the photo → `createBill` →
compression (`browser-image-compression`, loaded on demand) →
`generateUploadUrl` → POST to Convex storage → `attachImageAndExtract` patches `imageRef` and
runs `internal.extraction.actions.extractReceipt` (internalAction) via
**`@convex-dev/action-retrier`** (`convex/lib/retrier.ts`: transient vision failures retry
with backoff; final failure lands in `onExtractionComplete`, which marks the bill failed and
deletes the image — `bills.extractionRunId` + the `by_extractionRunId` index map run → bill)
→ the action reads image bytes, calls **Gemini via Cloudflare AI Gateway**
(`convex/extraction/vision.ts`, swappable `callVisionModel` seam; prompt in
`convex/extraction/prompt.ts`) → `applyExtraction` (internalMutation) normalizes to LBP,
runs the arithmetic checksum (`src/lib/money/reconcile.ts`), flags low-confidence/implausible
items, sets `PENDING` or `NEEDS_REVIEW`, and deletes the image. Storage access goes through the
`convex/lib/imageStore.ts` seam (Convex storage today, R2 possible later).
Rationale/eval plan: `convex-best-practices` skill, `rules/extraction-pipeline.md`.

### Currency

`src/lib/money/currency.ts` is a pure module imported by **both** browser code and Convex functions.
**LBP is the internal unit of record**; USD is derived at display time via the bill's `rate`
(default 90,000, `deriveRate` computes the venue rate when both printed totals exist;
`rateSource` records `receipt`/`market`/`manual`). Never store converted amounts.

### Routes

`src/routes/`: `index.tsx` (renders `LandingPage` — marketing hero + "Scan a receipt" CTA +
"Try a sample bill" demo; the scan CTA opens the native photo picker directly on tap.
Photo confirmation, manual entry, and recent bills from localStorage `billy:bill-history`
also live on the landing page; the separate `/scan` route has been removed),
`terms.tsx` + `privacy.tsx` (legal),
`review/$billId` (extraction review editor), `split/$billId` (host claim workspace),
`summary/$billId` (totals + publish/share link), `join/$shareToken` (guest view; localStorage
`guestSessionId`; guest mutations `joinSplit`/`addGuestPerson`/`saveGuestClaims` are
session-scoped, host writes are gated by status).

`src/routeTree.gen.ts` is **generated** — never edit by hand. Aliases: `~/*` → `src/*`,
`convex/*` → `convex/*`.

### Where code goes (quick router)

- New screen/flow → `src/components/features/<feature>/` with a `<Feature>Page.tsx`; the
  route file only wires `createFileRoute` + loader to it; sub-components in
  `<feature>/components/`, hooks in `<feature>/hooks/`, copy in `content.ts`.
- Component used by one feature → that feature's `components/`; bill-domain + used by ≥2
  features → the matching `features/bill/<cluster>/` (claims/people/receipt/workspace/summary,
  export it from the cluster barrel — and the top barrel only if other features need it);
  fully generic → `components/ui/` (shadcn via CLI when one exists).
- React state/lifecycle → feature hooks in the feature folder; cross-feature → `src/hooks/`.
- Pure helpers → the matching `src/lib/` group (`money/`, `bill/`, `format/`, `session/`,
  `ui/`), exported from that group's barrel; never in a route/page.
- Math shared by UI and backend → `src/lib/money/*`, `src/lib/bill/constants.ts`,
  `src/lib/types.ts` — imported by convex/ via concrete paths; keep them pure (no React,
  no barrels from convex).
- Convex function → `convex/bills/<host|guest>/<domain>.ts` (pick by caller), registered
  through a builder from `convex/bills/lib/functions.ts`, logic in `convex/model/`; then
  expose it to the UI via a hook in `src/api/`. Files that register no functions never live
  directly under `bills/host|guest/` — plumbing goes in `bills/lib/` or `model/`.
- External API calls → Convex actions only; `convex/schema.ts` is the source of truth for
  persisted shape.
- Constants → never inline in components: domain rules `lib/bill/constants.ts`, feature copy
  `<feature>/content.ts`, animation presets `lib/ui/animations.ts`.

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
