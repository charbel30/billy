# React + TanStack Query integration (@convex-dev/react-query)

This project does NOT use the bare `useQuery` from `convex/react`. It uses
`@convex-dev/react-query`, which turns Convex functions into TanStack Query option factories.
Wiring is in `src/router.tsx` (a `ConvexQueryClient` sets the query client's default
`queryFn`/`queryKeyHashFn`, and `ConvexProvider` wraps the app). Mirror `src/api/` (billQueries.ts for reads, billMutations.ts/uploads.ts for writes).

## Reads — `convexQuery` + a query factory

```ts
// src/api/billQueries.ts — colocate all read option factories here
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

export const billQueries = {
  detail: (id: string) => convexQuery(api.bills.getBill, { id }),
}
```

```tsx
// in a component / route
const { data } = useSuspenseQuery(billQueries.detail(billId))
```

Convex queries are live — they update over a WebSocket and invalidate automatically when a
mutation changes the underlying data. Do not add manual polling or `refetchInterval`.

## Writes — `useConvexMutation` + optimistic updates

Wrap `useConvexMutation` in `useMutation`. For instant UI, attach `.withOptimisticUpdate`,
reading and rewriting the cached query with `localStore.getQuery` / `setQuery` (exactly the
pattern in `src/api/billMutations.ts`):

```ts
const mutationFn = useConvexMutation(api.bills.setRate).withOptimisticUpdate(
  (localStore, args) => {
    const bill = localStore.getQuery(api.bills.getBill, { id: args.billId })
    if (!bill) return
    localStore.setQuery(api.bills.getBill, { id: args.billId },
      { ...bill, rate: args.rate, rateSource: args.source })
  },
)
return useMutation({ mutationFn })
```

- Mutation errors surface as toasts globally via the `MutationCache` in `src/router.tsx` —
  don't re-implement error toasts per mutation.
- For one-shot server work (the extraction action), use `useAction(api.extract.extractReceipt)`
  rather than a query factory.
- In routes, prefetch with `context.queryClient.ensureQueryData(billQueries.detail(id))` in a
  loader, then `useSuspenseQuery` in the component for SSR-friendly loading.
