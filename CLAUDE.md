# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A mobile-responsive **Receipt Splitter** web app for Lebanon's dual-currency (LBP/USD)
reality: photograph a receipt, a vision-LLM extracts the line items, the bill is shown in both
currencies at the rate the venue actually charged, and a group splits it item-by-item into
per-person totals shared via a link. The full product spec — concept, design decisions,
extraction pipeline, currency logic, split rules, data model, roadmap — lives in
**`receipt-splitter-build-spec.md`**. Read it for *what* to build and *why*.

> **Stack note:** the spec is the product source of truth, but its §7 tech-stack table is
> outdated. The spec proposes Supabase + React/Vite; this project actually uses **Convex +
> TanStack Start + Tailwind (+ shadcn/ui planned)**. When the spec says "Supabase edge
> function," read it as "Convex action"; "Postgres table" → "Convex table." The product logic
> (pipeline, checksum, currency, split) still applies as written.

The codebase currently is the **TanStack Start + Convex "Trellaux"** (Trello clone) starter —
boards/columns/items. It is scaffolding to be replaced with the bills/line-items/people/
assignments model from spec §6.2. Treat the existing `board.*` code as a reference pattern for
Convex+TanStack wiring, not as the product.

## Commands

```bash
pnpm install          # install (pnpm is the package manager)
pnpm dev              # runs `convex dev --once` then concurrently starts Vite + convex dev
pnpm dev:web          # Vite only (frontend on http://localhost:3000)
pnpm dev:db           # convex dev + seeds the demo board
pnpm build            # vite build && tsc --noEmit  (this is also the typecheck)
pnpm preview          # preview the production build
npx convex dev        # provision/connect your own Convex backend (writes VITE_CONVEX_URL)
npx convex env set NAME value   # set a backend secret (LLM key, etc.) — never in client code
```

- **There is no lint or test setup** and no test runner configured. "Typecheck" = `pnpm build`
  (or `tsc --noEmit`). Don't invent test/lint commands.
- `VITE_CONVEX_URL` must be set (see `.env.local.example`). The default points at a shared
  read-only backend; run `npx convex dev` to get your own writable deployment.

## Architecture

**Data flow:** React component → TanStack Query option factory (`src/queries.ts`) →
`@convex-dev/react-query` → Convex function (`convex/`) → Convex reactive DB. Reads live-update
over a WebSocket; mutations auto-invalidate affected queries.

### How TanStack Start + TanStack Query + Convex work together

Three layers joined by one adapter package, `@convex-dev/react-query`:
- **TanStack Start** is the full-stack React framework — SSR, file-based routes, and route
  loaders.
- **TanStack Query** is the client cache/request layer — keys, suspense, optimistic updates,
  devtools.
- **Convex** is the reactive backend — query functions run server-side and Convex **pushes**
  fresh results whenever underlying data changes.

The adapter is the key idea: normally TanStack Query is *pull*-based (refetch/poll); the Convex
adapter makes it *push*-based. `src/router.tsx` sets the adapter's `queryFn`/`queryKeyHashFn` as
the `QueryClient` defaults and calls `convexQueryClient.connect(...)`, so passing a
`convexQuery(api.x.y, args)` factory to a normal `useQuery`/`useSuspenseQuery` both fetches
**and opens a live WebSocket subscription**. When any mutation changes the data, Convex
recomputes affected queries and pushes them — components re-render with no manual invalidation
and no polling.

Practical consequences:
- Use **`useSuspenseQuery`** for a route's primary data — it fetches during the server SSR pass
  (fast first paint); `useQuery` is client-only. Optionally prefetch in a loader with
  `context.queryClient.ensureQueryData(...)`. `setupRouterSsrQueryIntegration` carries the cache
  across the SSR→hydration boundary.
- **Writes** use `useConvexMutation` wrapped in `useMutation`; you usually do **not**
  `invalidateQueries` (Convex pushes the update). Add `.withOptimisticUpdate` for instant UI.
- Convex live queries don't "go stale," so `staleTime`/`refetchInterval` are irrelevant — don't
  add polling. This is also why the spec's live guest-claim feature is essentially free.
- Full detail + gotchas in the `convex-best-practices` skill
  (`rules/tanstack-convex-architecture.md`).

Key files to understand the wiring (read these before adding features):
- `src/router.tsx` — creates the `ConvexQueryClient`, sets it as TanStack Query's default
  `queryFn`/`queryKeyHashFn`, wraps the app in `ConvexProvider`, and registers a global
  `MutationCache.onError` that toasts every mutation error (so don't toast errors per-mutation).
- `src/queries.ts` — the **pattern to copy**: `convexQuery(api.x.y, args)` option factories for
  reads, and `useConvexMutation(...).withOptimisticUpdate(...)` wrapped in `useMutation` for
  writes. Optimistic updates read/rewrite the cache via `localStore.getQuery/setQuery`.
- `convex/schema.ts` — `defineSchema`/`defineTable` with indexes; note how reusable arg
  validators are **derived from the table validators** rather than re-typed.
- `convex/board.ts` — all query/mutation handlers; `getFullBoard` shows assembling a relation
  (parent + children via `Promise.all`) into one consistent server-side snapshot.
- `convex/crons.ts` — scheduled jobs (model for the Phase-2 FX refresh and image-TTL purge).

**Routing:** TanStack Start file-based routes in `src/routes/` (`__root.tsx`, `index.tsx`,
`boards.$boardId.tsx`). `src/routeTree.gen.ts` is **generated** — never edit it by hand.
Path aliases: `~/*` → `src/*`, `convex/*` → `convex/*`.

**Important constraint — function types:** Convex queries and mutations **cannot** call external
APIs or use Node (`fetch` is unavailable). The vision-LLM extraction and any FX-rate fetch MUST
be Convex **actions** (`internalAction`), which then persist results via a mutation. This is the
single most important architectural rule for implementing the spec's extraction pipeline.

**Extraction model decision:** primary extractor is **Gemini (vision)**, called from the extract
action through **Cloudflare AI Gateway** (caching/retries/fallback/cost analytics; key in Convex
env vars). Route on the arithmetic checksum: pass → READY, fail/low-confidence → escalate or flag
NEEDS_REVIEW. Use a **general VLM, not an OCR specialist** — the differentiator is reasoning
(recovering occluded quantities from totals), which OCR engines can't do. Chosen fallback if
direct image→JSON is poor: a two-stage **OCR → text-LLM** path (e.g. PaddleOCR + a cheap text
model). Keep the provider behind one swappable interface; open-weight alternatives (Qwen3-VL,
InternVL3.5) can run via serverless inference or Workers AI later. Full rationale, call
requirements, and the pre-commit eval plan are in the `convex-best-practices` skill
(`rules/extraction-pipeline.md`).

## Skills

`.claude/skills/` contains best-practice skills — consult the matching one before non-trivial
work in that area:
- `convex-best-practices` — schema/indexes, query vs mutation vs action, validators, the
  action→mutation pattern for external APIs, file storage, scheduling, react-query integration.
- `tanstack-start-best-practices`, `tanstack-router-best-practices`,
  `tanstack-query-best-practices`, `tanstack-virtual-best-practices`.

For any other library/API/CLI question, fetch current docs via `ctx7` (see the global rule)
rather than relying on memory — `npx ctx7@latest docs <libraryId> "<question>"`.

## Conventions

- Tailwind v4 via `@tailwindcss/vite` (config in `vite.config.ts`, styles in
  `src/styles/app.css`); `tailwind-merge` is available. shadcn/ui is planned but **not yet
  installed** (no `components.json` / `src/components/ui`) — initialize it before importing its
  components.
- React 19, TypeScript `strict`. Mutations validate args with `convex/values` `v.*`; prefer
  `v.id('table')` for references over raw strings (see the convex skill's `ids-and-relations`).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
