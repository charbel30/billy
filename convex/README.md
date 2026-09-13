# Convex functions

Public bill functions are split by **caller** (host/guest) then **domain**,
and file path = api namespace: `convex/bills/host/lifecycle.ts` is
`api.bills.host.lifecycle.*`, `convex/bills/guest/claims.ts` is
`api.bills.guest.claims.*`. Any file that registers no public function (just
helpers, builders, validators) must live outside `bills/host/` and
`bills/guest/` — those two folders are the API surface, nothing else. After
moving or renaming a function file, run `npx convex dev --once` to
regenerate `_generated/`; renames change the public function path, so update
every caller (all frontend Convex references live in `src/api/`, per
`CLAUDE.md`).

## Layout

- `bills/host/` — host-side functions, gated by bill id and host credential (`ctx.bill` injected
  by `billMutation`/`editableBillMutation`/`settleBillMutation`).
  - `lifecycle.ts` — `createBill`, `createDemoBill`, `saveWorking`, `publish`,
    `finalize`, `revokeShare`, `setTipPercent`.
  - `people.ts` — `addHostPerson`, `removeHostPerson`, `setHostPersonPaid`.
  - `claims.ts` — `stepHostClaim`, `shareHostItemEvenly`,
    `splitLeftoversEvenly`.
  - `queries.ts` — `getBill`.
  - `uploads.ts` — `generateUploadUrl`, `attachImageAndExtract` (schedules the
    extraction action).
- `bills/guest/` — guest-side functions, scoped by `shareToken` +
  `guestSessionId` (`ctx.bill` + `ctx.guestSessionId` injected by
  `guestMutation`/`guestSettleMutation`).
  - `people.ts` — `joinSplit`, `addGuestPerson`, `setGuestPersonPaid`.
  - `claims.ts` — `stepGuestClaim`, `shareGuestItemEvenly`.
  - `queries.ts` — public `getBillByToken` and caller-scoped `getControlledPeople`.
- `bills/extraction.ts` — internal mutations only (`applyExtraction`,
  `onExtractionComplete`); not under host/ or guest/ since nothing here is a
  public host/guest function.
- `bills/lib/` — registers no functions, so it creates no api namespace.
  Plumbing shared by every bills function lives here.
  - `functions.ts` — the custom function builders (convex-helpers
    `customMutation`/`customQuery`). Every public bills function registers
    through one of these instead of raw `mutation`/`query`; new cross-cutting
    concerns (auth, roles, limits, transformations) go here, not in handlers.
  - `validators.ts` — reusable `v.*` validators derived from `schema.ts`.
- `model/` — plain-TS helpers, no registered functions. Public functions stay
  thin wrappers that call into here (the official Convex pattern).
  - `bills.ts` — gates/validation (`assertEditableSplit`, `assertSettleOpen`,
    `assertSharedForGuestWrites`, …) and claim math (`saveClaimsForPerson`).
  - `claimChanges.ts` — applies item/person add/remove intent to current claims.
  - `claimRows.ts` — the claims-table seam: reads, wire mapping, and keyed
    row-diff sync. All claim-row access goes through here; claim mutations do
    not touch the bill document.
- `extraction/` — the vision pipeline: `actions.ts` (internal action that
  reads the image, calls the vision model, persists results),
  `vision.ts` (swappable Cloudflare AI Gateway/Gemini call), `prompt.ts`
  (extraction prompt + JSON contract).
- `lib/` — Convex-side infra helpers: `imageStore.ts` (storage seam),
  `invariant.ts` (assertion helper), `rateLimits.ts` (per-device rate limiter
  config), `retrier.ts` (`@convex-dev/action-retrier` wiring for extraction
  retries/backoff).
- `schema.ts` — source of truth for persisted shape: `bills` (stable, bounded
  metadata/lineItems/people as embedded arrays) + `claims` (its own high-churn
  table, `by_bill` index — see the file header and
  `docs/architecture-decision.md` §Revisited for the cost rationale).
- `crons.ts` — placeholder for scheduled backend work (FX refresh, image TTL
  cleanup).

## The builder rule

Register every new public bills function through a builder from
`convex/bills/lib/functions.ts` — never with raw `mutation`/`query`. The
builders resolve identity (bill id, or shareToken + guestSessionId, or
deviceId), apply the right status gate, and inject `ctx.bill` (and
`ctx.guestSessionId` for guest builders) so handlers hold only domain logic.
This is also where future auth/role checks land, once identity moves beyond
bill-id/share-token capability.

## Shared pure modules

Convex imports frontend-shared pure logic from `src/lib/` **by concrete file
path**, never through a barrel (so backend code can't accidentally pull in
React): `src/lib/money/currency.ts`, `src/lib/money/reconcile.ts`,
`src/lib/bill/constants.ts`, `src/lib/types.ts`. These are the modules kept
framework-free specifically so both sides can share them.

## Claim regression tests

Run `pnpm test` for Convex mutation tests and pending-write coordination tests.
The Convex tests use `convex-test` in Vitest's edge runtime and synthetic bills;
they do not contact a deployed backend. Convex was updated to 1.45.0 to satisfy
the current `convex-test` peer requirement (at least 1.43.0).

Claim taps send `itemId`, `personId`, and `delta` (+1/-1); subscribed results
remain the UI's source of truth. No person-wide claim list is sent by a tap.
Deploy the updated backend and frontend together. Clients already open on the
removed `saveHostClaims` / `saveGuestClaims` endpoints must reload.

## Read access and editor acknowledgements

`getBill` requires both `id` and `hostToken`. Host route SSR renders a loading
shell; private receipt queries begin after browser access is available.
`getBillByToken` requires a current published/finalized invitation. Neither
query returns participant edit credentials. `getControlledPeople` returns only
the participant IDs controlled by the supplied current guest credential.

Guest credentials predating access version 2 are invalidated, with old names and
claims retained for host management. The client creates fresh credentials in a
new storage namespace. Never backfill old exposed tokens into the new version.

`saveWorking` requires `baseVersion` and returns the committed `version`.
Stale or finalized writes throw; the editor retains its recovery draft and
requires an explicit decision on conflicts. Extraction records its starting
version and applies only while that version and its upload are still current.

See [the readiness review](../docs/launch-readiness-review.md) for rollout and the
remaining production acceptance checks. The full regression suite now covers
access control, extraction, editor recovery, storage and settlement math.
