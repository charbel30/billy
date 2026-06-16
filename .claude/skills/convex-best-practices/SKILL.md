---
name: convex-best-practices
description: Convex best practices for schema design, indexes, queries/mutations/actions, argument validators, file storage, scheduled functions, and the @convex-dev/react-query + TanStack integration used in this project. Activate when writing or editing anything under convex/, or wiring Convex data into React via TanStack Query.
---

# Convex Best Practices

Convex is the reactive backend for this project: a real-time document database + serverless
TypeScript functions + file storage. Functions live in `convex/`. The client consumes them
through `@convex-dev/react-query`, which adapts Convex into TanStack Query option factories
(`convexQuery`) and mutation hooks (`useConvexMutation`). See `src/queries.ts` for the live
pattern and `src/router.tsx` for the wiring.

## When to Apply

- Adding or editing tables, indexes, or validators in `convex/schema.ts`.
- Writing query / mutation / action functions in `convex/`.
- Calling an external API (vision-LLM, FX feed) from the backend → that is an **action**.
- Scheduling recurring work (FX refresh, data cleanup) → `convex/crons.ts`.
- Wiring backend data into React components via TanStack Query.

## The three function types — pick the right one

| Type | `import` from `_generated/server` | Can read DB | Can write DB | Can call external APIs / use Node | Reactive |
|---|---|---|---|---|---|
| `query` | `query` / `internalQuery` | ✅ | ❌ | ❌ | ✅ (live-updates over WebSocket) |
| `mutation` | `mutation` / `internalMutation` | ✅ | ✅ (transactional) | ❌ | — |
| `action` | `action` / `internalAction` | via `ctx.runQuery` | via `ctx.runMutation` | ✅ | — |

Rules of thumb:
- **Queries and mutations cannot do `fetch` or use Node APIs.** Anything touching the network
  (the vision-LLM extraction call, an FX-rate fetch) MUST be an `action`.
- An action does not have `ctx.db`. It reads/writes by calling queries/mutations:
  `await ctx.runMutation(internal.bills.insertBill, {...})`.
- Keep DB writes in mutations so they stay transactional; do external work in the action,
  then persist the result via one mutation at the end.
- Use the `internal*` variants for anything that should not be callable from the browser
  (e.g. the LLM call, cron handlers). Reference them via `internal.*`, public ones via `api.*`.

## Always validate args (and prefer return validators)

Every public function must declare `args` validators built with `v`. This is a security
boundary, not just types — unvalidated public functions accept arbitrary input.

```ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const setRate = mutation({
  args: { billId: v.id('bills'), rate: v.number(), source: v.union(
    v.literal('receipt'), v.literal('market'), v.literal('manual')) },
  handler: async (ctx, { billId, rate, source }) => {
    await ctx.db.patch(billId, { rate, rateSource: source })
  },
})
```

Derive reusable validators from the schema instead of re-typing them — this codebase already
does it in `convex/schema.ts` (`schema.tables.items.validator`, `updateBoardSchema`, etc.).
Follow that pattern for new tables.

## Read more in rules/

- `rules/tanstack-convex-architecture.md` — **how TanStack Start + Query + Convex fit
  together** (the adapter, push-based live queries, SSR). Read this first for the mental model.
- `rules/schema-and-indexes.md` — table design and querying by index (never filter-scan).
- `rules/actions-external-apis.md` — the action → mutation pattern for the LLM/FX calls.
- `rules/extraction-pipeline.md` — vision-LLM model choice (Gemini via Cloudflare AI Gateway,
  OCR→LLM fallback, open-weight options) and the extract action call shape.
- `rules/react-query-integration.md` — `convexQuery`, optimistic updates, this project's wiring.
- `rules/ids-and-relations.md` — `v.id`, system fields, modelling relations.
- `rules/file-storage.md` — storing/serving receipt images if you keep them.
- `rules/scheduling.md` — crons and the scheduler.

Verify anything version-specific against current docs with
`npx ctx7@latest docs /llmstxt/convex_dev_llms-full_txt "<question>"`.
