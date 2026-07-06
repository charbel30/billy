Verdict: keep the one-document bill; don't split it. The right structure going forward is "one aggregate document per bill, plus new top-level tables for things that outlive a bill" — which is exactly what the roadmap already sketches for Phase B. Splitting the bill itself into child tables would make query count and size worse, not better. Here's the reasoning:

Why the embedded-arrays bill is still right

- It minimizes queries by construction. Every route today is exactly one subscribed query (billQueries.detail / byToken) returning one document. Normalize lineItems/people/claims into child tables and each page load becomes a query function reading 1 + N + M + K documents, and every claim tap invalidates that whole joined read anyway (Convex re-runs the query when any doc it read changes). You'd add read amplification to gain nothing.
- Atomicity is load-bearing. The reconcile checksum, claim capacity-clamping (saveClaimsForPerson), and the version counter all assume the whole bill mutates consistently in one write. With child tables you'd be reinventing transactions across rows for a document that's naturally one unit.
- The whole local-first editor is built on it. useBillEditor's whole-doc flush, sanitizeWorkingBill, localStorage mirroring — all of that assumes one shape. architecture-decision.md called this out explicitly, and the concern it flagged as the trade-off ("no live multi-writer claims") was since solved without re-normalizing, via the scoped guest mutations that merge one person's claims server-side.
- Size is nowhere near limits. Convex caps documents at ~1 MiB and arrays at 8,192 elements. A worst-case club tab — say 200 line items, 30 people (your cap), ~1,000 claims — is on the order of 100 KB. Re-scan merge in venue mode doesn't change that math; it grows the same arrays by receipt-sized increments.

What the roadmap additions actually need

The upcoming fields on the roadmap are almost all small scalars on the bill (paidAt, paymentNote, tip, tipSplitMode, venueId, tableName) — they cost nothing. The rule for everything else is lifecycle, not size:

┌───────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
│               Lives inside bills (embedded)               │                          Own table (new top-level)                           │
├──────────────────────────

Anything shared across bills or outliving one gets a table + index (by_venue), and the bill just carries a foreign id. That's the §3 design and it's correct.

"Separating schemas" as file organization — yes, do that

Convex requires a single defineSchema in convex/schema.ts, but nothing says the validators must live there. You already half-follow this pattern (convex/bills/validators.ts composes from schema.ts). As Phase B lands, invert it: per-domain validator modules (convex/bills/, convex/venues/, convex/tables/) each exporting their table definition, with schema.ts reduced to composition. That keeps the growth manageable without touching the data model.

The two things actually worth watching

1. Push bandwidth, not query count. The one real cost of the single-doc model: every claim tap bumps version and Convex re-sends the doc to every subscriber. A venue night ≈ sessions × claims × subscribers × doc-size. It's fine at consumer scale; if venue dashboards + 30-guest tables make the Convex bandwidth graph interesting, the fix is projected queries for guest views (return a trimmed shape instead of the whole doc) — a query-layer change, no schema change.
2. OCC write contention on hot bills. 30 guests writing the same document concurrently means occasional conflict-retries. Convex handles retries automatically and a table's tap rate is low, but it's the metric to check in the dashboard once venues are live (convex-performance-audit skill covers exactly this).

Both have cheap mitigations that don't require restructuring — which is the point: the single-document design fails gracefully at scale, while normalizing now would cost you the editor, atomicity, and query economy immediately for a problem you may never have.
