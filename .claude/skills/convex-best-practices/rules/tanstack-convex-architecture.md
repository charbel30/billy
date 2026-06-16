# How TanStack Start + TanStack Query + Convex fit together

This project glues three layers with one adapter package, `@convex-dev/react-query`. Understand
the seam once and every data feature follows the same shape.

## The mental model — who owns what

```
TanStack Start  ── full-stack React framework: SSR, file-based routes, route loaders
      │            (renders the app on the server, hydrates on the client)
TanStack Query  ── client cache + request lifecycle: keys, staleness, suspense,
      │            optimistic updates, devtools
@convex-dev/    ── the ADAPTER: turns a Convex function reference into a TanStack Query
 react-query       `queryFn` + stable `queryKey`, AND opens a live WebSocket subscription
      │
Convex          ── reactive backend: the query function runs server-side, and Convex
                   PUSHES new results whenever the underlying data changes
```

The trick: normally TanStack Query is *pull*-based (you refetch / poll). The Convex adapter
makes it *push*-based. You still call `useQuery`/`useSuspenseQuery` exactly like normal React
Query, but instead of going stale and refetching, the cached entry is **kept live by a
WebSocket** — when a mutation anywhere changes the data, Convex recomputes the query and pushes
it, and TanStack Query re-renders the component. No `refetchInterval`, no manual invalidation.

## The wiring (one place: `src/router.tsx`)

Three lines make the whole thing work — see the real file:

1. `const convexQueryClient = new ConvexQueryClient(CONVEX_URL)` — the adapter, holding the
   Convex WebSocket client.
2. The `QueryClient` is created with the adapter's `queryKeyHashFn()` and `queryFn()` as
   **defaults**. This is what lets you pass a `convexQuery(...)` factory to any `useQuery` and
   have it "just work" — the default `queryFn` knows how to run a Convex function and subscribe.
3. `convexQueryClient.connect(queryClient)` wires live updates into the cache, and
   `setupRouterSsrQueryIntegration({ router, queryClient })` dehydrates/rehydrates the cache
   across the SSR boundary. `ConvexProvider` in `Wrap` gives the client to Convex hooks.

You rarely touch this again — feature code only uses the factories from `src/queries.ts`.

## Reads — same hook, two behaviors

`convexQuery(api.bills.getBill, { id })` returns standard TanStack Query options. Pass it to:

- **`useSuspenseQuery`** — fetches during the **server** SSR pass, so the HTML ships with data
  (best for first paint). Use this for a route's primary data. Pair with a route
  `pendingComponent` for the loading state.
- **`useQuery`** — client-only fetch (does **not** run during SSR). Use for secondary/optional
  data where SSR isn't worth it.

Either way, after hydration the entry stays live over the WebSocket.

### Prefetch in a route loader (optional, for SSR + instant nav)

```ts
export const Route = createFileRoute('/review/$billId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(billQueries.detail(params.billId)),
  component: Review,
})
// component then reads the same factory with useSuspenseQuery → already warm
```

`context.queryClient` is available because `src/router.tsx` puts it on the router context.

## Writes — `useConvexMutation`

`useMutation({ mutationFn: useConvexMutation(api.bills.setRate) })`. After the mutation lands,
Convex automatically pushes fresh results to **every** live query it affected — so you usually
do **not** call `queryClient.invalidateQueries`. For instant feedback before the round-trip,
attach `.withOptimisticUpdate` (see `react-query-integration.md`). Errors surface through the
global `MutationCache.onError` toast in `src/router.tsx`.

## Why this stack for the receipt splitter

The guest-claim feature (spec §9.2 — friends tap their items, everyone's totals fill in live) is
*free* here: every viewer's `getBill` query is a live subscription, so one person's assignment
mutation updates all open devices over the WebSocket with no extra sync code. SSR via
`useSuspenseQuery` keeps the share link fast to first paint on a phone.

## Gotchas

- Don't mix the bare `useQuery` from `convex/react` with the TanStack flow — always go through
  `convexQuery` / `useConvexMutation` so caching, SSR, and devtools stay consistent.
- Live queries don't "go stale," so `staleTime`/`refetchInterval` are largely irrelevant for
  Convex queries — don't add polling.
- Anything needing `fetch`/Node is still an **action**, not a query (see
  `actions-external-apis.md`); actions aren't reactive and aren't consumed via `convexQuery` —
  trigger them with `useAction` or the scheduler.
