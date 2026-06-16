# IDs, system fields & relations

## Use `v.id('table')`, not `v.string()`, for references

Convex's native document id is `Id<'table'>`. Validate foreign keys with `v.id('bills')` — it
is type-safe end to end and lets you `ctx.db.get(id)` directly. (The Trellaux starter uses a
separate `v.string()` `id` field with an `index('id', [...])` only because it ported an
in-memory demo; for new tables in this project, prefer the native `_id` + `v.id()` references.)

```ts
const bill = await ctx.db.get(billId)        // billId: Id<'bills'>
if (!bill) throw new Error('bill not found') // get() returns null if missing
```

## System fields

Every doc has `_id: Id<'table'>` and `_creationTime: number`. Don't redefine or store them
yourself. When returning docs to the client you can strip them; the starter has a
`withoutSystemFields` helper in `convex/board.ts` — reuse that idea rather than hand-rolling.

## Modelling relations

Convex has no joins. Model a relation with a `v.id(...)` field + an index, then fetch children
in the parent query and assemble the shape the UI needs (see `getFullBoard` in
`convex/board.ts`, which loads a board plus its columns and items in parallel with
`Promise.all`). Do the assembly server-side in one query so the client gets a consistent
snapshot — Convex guarantees the read is consistent within a single query.
