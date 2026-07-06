# Schema design & indexes

Schema lives in `convex/schema.ts` via `defineSchema` / `defineTable`. Convex documents always
carry system fields `_id` (a typed `Id<'table'>`) and `_creationTime` — do not redefine them.

## Query by index, never filter-scan

`.filter()` on a query scans every document. For anything beyond a tiny table, define an index
and use `.withIndex()` instead:

```ts
// convex/schema.ts (the real one)
claims: defineTable({
  billId: v.id('bills'),
  itemId: v.string(), personId: v.string(), units: v.number(),
}).index('by_bill', ['billId']),
```

```ts
// query
const rows = await ctx.db
  .query('claims')
  .withIndex('by_bill', (q) => q.eq('billId', billId))
  .collect()
```

- Index field order matters: list equality fields first, then a range field last.
- `.unique()` for at-most-one results (throws if more than one), `.first()` for the first,
  `.collect()` only for tightly bounded sets. Use `.paginate()` for unbounded lists.
- A name like `by_bill` reading "by these fields" keeps call sites obvious.

## Modelling the bill: embed the stable, row the churny

This project deliberately does NOT fully normalize the bill, and does NOT fully embed it
either (`architecture-decision.md`, revisited 2026-07-06). The dividing rule:

- **Embed in the `bills` document**: stable + bounded + bill-scoped data — `lineItems`,
  `people`, meta. They're atomic with the reconcile checksum and owned by the local-first
  editor. Bounded means receipt-sized items and the 30-person guest cap; nowhere near the
  1 MiB doc / 8192-element array limits.
- **Own table with an index**: high-churn, unbounded, or cross-bill data — `claims` today
  (every tap used to rewrite the whole document; rows make a tap a few hundred bytes and
  conflict-free between guests), and venues / table sessions / menu priors / reports later.

Why churn matters: any `ctx.db.patch` rewrites the FULL document in the log, and the
subscribed query re-reads it — billed Database I/O ≈ 3× doc size per embedded-array tap.
Query results are cached per (query, args), so subscriber count does not multiply cost.

Mechanics to copy when adding child tables:
- One seam module for all row access (`convex/bills/claimRows.ts`): indexed read, wire-shape
  mapping (strip `billId`/`_id`), and a keyed **row-diff sync** so unchanged rows cost zero
  writes.
- **Preserve the wire shape**: queries assemble `{ ...bill, claims }` so the frontend still
  sees one object; reading the rows inside the query also subscribes it to them.
- Row mutations don't touch the parent doc (no `version` bump); cascade-delete rows when the
  parent dies (see `convex/crons.ts` purge).

Keep per-person totals **computed in a query/client**, never stored, so they can't drift.
Store every amount in LBP plus `rate` and `rateSource` on the bill.
