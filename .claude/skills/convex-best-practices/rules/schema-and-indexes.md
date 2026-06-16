# Schema design & indexes

Schema lives in `convex/schema.ts` via `defineSchema` / `defineTable`. Convex documents always
carry system fields `_id` (a typed `Id<'table'>`) and `_creationTime` — do not redefine them.

## Query by index, never filter-scan

`.filter()` on a query scans every document. For anything beyond a tiny table, define an index
and use `.withIndex()` instead:

```ts
// schema.ts
bills: defineTable({
  shareToken: v.string(),
  status: v.union(v.literal('DRAFT'), v.literal('NEEDS_REVIEW'),
                  v.literal('READY'), v.literal('SHARED')),
}).index('by_share_token', ['shareToken']),

lineItems: defineTable({
  billId: v.id('bills'),
  name: v.string(), qty: v.number(), unitPrice: v.number(),
}).index('by_bill', ['billId']),
```

```ts
// query
const items = await ctx.db
  .query('lineItems')
  .withIndex('by_bill', (q) => q.eq('billId', billId))
  .collect()
```

- Index field order matters: list equality fields first, then a range field last.
- `.unique()` for at-most-one results (throws if more than one), `.first()` for the first,
  `.collect()` for all. Use `.paginate()` for unbounded lists (see react-query rule).
- A name like `by_bill` reading "by these fields" keeps call sites obvious.

## Modelling the receipt-splitter schema

The spec's relational model maps directly. Use `v.id('bills')` foreign keys + an index per
relation, and keep per-person totals **computed in a query**, not stored, so they never drift.
Store every amount in its original currency plus `rate` and `rateSource` on the bill.
