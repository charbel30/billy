# Shared-session validation

Validated September 14, 2026 against the working tree following `eb7eced`.

## Why participants disappeared

Commit `af56f2f` introduced the mobile picker using `ownIds` to filter its entire
participant list. Guests therefore saw only people they could manage; hosts,
which have no ownership filter, saw everyone. Convex stored and returned the
correct shared bill. Permissions had accidentally become a visibility rule.
The prior backend tests could not catch a mobile rendering regression.

`eb7eced` restores visibility while retaining edit restrictions and shows the
entered name with a `(you)` suffix. The static mobile rendering regression test
is complemented by the browser smoke test below.

## Checks performed

- `pnpm test`: 81 tests pass across 12 files.
- `pnpm exec tsc --noEmit`: passes.
- `git diff --check`: passes.
- `node scripts/test-realtime.mjs http://127.0.0.1:3320`: passes against an
  isolated local Convex server with the project's actual components installed.
- `scripts/test-realtime-browser.mjs`: passes in Chromium with separate desktop
  host and mobile guest browser contexts, Vite on port 5180, and the isolated
  backend on port 3320.

### Function and session coverage

| Area | Evidence |
| --- | --- |
| Creation and editing | Real rate-limiter component; manual and demo creation; save validation; stale-version rejection; preservation of ownership metadata |
| Join and participants | Publish, independent guests, idempotent rejoin, companions, scoped ownership queries, host add/remove, removal of associated claims |
| Claims | Host/guest stepping, repeated intents, capacity conflicts, sharing, undo, forged/stale undo rejection, leftovers and finalization gates |
| Totals and settlement | Tip updates, guest and host paid toggles after finalization, unauthorized edits rejected |
| Share lifecycle | Revocation invalidates existing guest subscriptions; replacement link opens the same bill; finalization propagates |
| Upload and extraction | Upload URL, pause switch, attach action, real retrier scheduling, idempotent attachment, successful result application, retry exhaustion, cleanup, abandonment and late-result protection |
| WebSocket delivery | Three independent clients receive joins, ownership changes, row-only claim changes, tips and removals; concurrent last-unit claims accept exactly one; a fresh connection recovers current state |
| Browser flow | Actual join form; host and guest both see participants; guest can inspect host totals without selecting the host; reload preserves identity; additions and claims update mounted screens; host claim removal is disabled for guests |

The frontend uses one connected `ConvexQueryClient` and the corresponding
`ConvexProvider`. Both host and guest bill queries read the bill document and
its claim rows. This makes participant changes and claim-only writes reactive.
Client mutation/action calls match the registered function types.

## Additional fixes from this audit

1. The invite dialog previously exposed the QR before publishing completed.
   It now waits for successful publication; a failure leaves the dialog closed.
   Tests cover a pending publication, failure, and an already published bill.
2. The action retrier's `maxFailures` counts retries after the initial call.
   The previous value of 3 made four provider calls, exceeding the documented
   three-call budget. It is now 2. The delay base is adjusted to match the
   intended approximately 0s/1s/5s attempt schedule, subject to jitter. The
   failure test exercises the actual component and asserts three calls.

## Limits and remaining observations

- These tests do not certify the deployed app's current code, networking,
  credentials or provider availability. No production receipts were changed.
- The AI provider is simulated in automated extraction tests. Successful real
  Gemini extraction and receipt-reading accuracy are not certified here.
- A fresh WebSocket connection is tested; transient connection loss and queued
  offline writes are not covered by this smoke test.
- Static review found a maintenance scaling risk: `purgeStaleBills` can delete
  claims for 50 large bills in one transaction. Claim-level batching is still
  needed before claiming this cleanup handles maximum-sized batches safely.
- Direct reads of an unpublished guest link are rejected by the backend, so
  JoinPage's existing “not open yet” notice remains unreachable. The invite
  fix prevents the normal UI from exposing that premature link.
- Chromium emitted development-tool hydration attribute warnings (`data-base-ui-inert`); the tested session interactions still passed. These warnings were not investigated in this backend audit.
- Claim mutations read the bill's full claim range. Transaction retries protect
  correctness, but this is not a high-concurrency load/performance certification.

## Repeating the smoke tests

Use an isolated local Convex deployment with the current functions and both
components installed. The WebSocket script refuses remote URLs and creates
synthetic bills. Keep deployment configuration separate from `.env.local`;
Convex CLI configuration commands can rewrite that file even with `--env-file`.

```sh
node scripts/test-realtime.mjs http://127.0.0.1:3320
VITE_CONVEX_URL=http://127.0.0.1:3320 VITE_CONVEX_SITE_URL=http://127.0.0.1:3321 pnpm exec vite dev --host 127.0.0.1 --port 5180
```

For the browser script, install Playwright and Chromium in the test environment.
If Playwright is not installed in this project's module path, set
`PLAYWRIGHT_MODULE` to its absolute `index.mjs` path:

```sh
node scripts/test-realtime-browser.mjs
```

Neither script deploys code. Test bills remain only in the isolated local
database, which can be discarded after stopping the backend.
