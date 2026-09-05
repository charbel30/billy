# Launch plan — Spolio (public launch 2026-09-15)

Outcome of the 2026-09-01 grilling session. This is the cut line for the Reddit
launch: if it isn't here, it doesn't ship before 2026-09-15.

Reviewed 2026-09-05 against the plan and relevant code. The scope is sound, but
launch readiness is **not yet verified**. Implementation status below does not
mean production configuration, real-device behavior, or alert delivery passed.
This file is the source of truth for the September consumer launch; the older
`ROADMAP.md` is background for the later venue product.

## The framing

"Production ready" is not a property of the codebase — it's a property of the
codebase relative to the claim being made to strangers. The claim is a **full
consumer-side launch on Reddit**: cold traffic, no context, mostly phones, and
an unforgiving audience. Every item below is derived from that event.

Probing the codebase (rate limiter, custom function builders, TTL cron, module
boundaries) found it deliberate and sound. **The gap is not architecture — it is
the missing failure path and the missing learning loop.** Nothing in this plan
restructures existing code.

## Settled decisions

| Area | Decision |
| --- | --- |
| Launch | Full consumer launch on Reddit, 2026-09-15. Venue/business side is a later product. |
| Identity | No login. Anonymous device-id + shareToken model ships as-is. |
| Brand | Rename Billy -> **Spolio** (domain owned). localStorage keys stay `billy:*`. |
| Host security | Add `hostToken` to the host function builders. Bill id alone must not grant host powers. |
| Spend | $30/mo target ceiling. Existing limiter is 400/day; dollar bounds and total operating-cost coverage remain unverified. |
| Failure path | Rescan offered first, **blank-bill entry** as the floor beneath it. Both before launch. |
| Analytics | Cloudflare Web Analytics + Sentry (client-side). Convex event table deferred. |
| Root route | Hero -> prominent Scan CTA opens the photo picker directly -> photo confirmation -> review. Camera opens on tap only. Separate `/scan` page removed; manual entry and recent bills live on `/`. |
| Legal | Short, truthful terms + privacy. Plus a one-line disclosure beside the landing scan action and photo confirmation. |
| Language | English UI. Arabic **extraction** must still be tested. |
| Devices | Host: iOS Safari. Guest: must also work on Android Chrome + WhatsApp in-app browser. |

## Explicit non-goals

Accounts/auth - venue/business features - Arabic UI localisation - architecture
refactor - self-built analytics dashboard - desktop polish beyond "works".

## Work, in order

### 1. Quick wins — IMPLEMENTED

- Devtools gated out of production in `src/routes/__root.tsx`.
- Starter image `public/tanstack.png` removed.
- `/` recomposed around the hero, scan CTA, and how-it-works below the fold;
  camera opens only after a tap.
- Venue section removed from the consumer landing page.
- `CLAUDE.md` updated to describe `LandingPage` at the root route.

### 2. Rename to Spolio — IMPLEMENTED (mailbox verification outstanding)

Landing copy, `content.ts`, SEO/meta, `site.webmanifest`, social image, legal
copy, and `src/lib/format/shareText.ts` updated. Verify the actual shared text
says Spolio and carries the working production join link during the walkthrough.

### 3. Host token — IMPLEMENTED

Host mutations require `hostToken` through the builders in
`convex/bills/lib/functions.ts`; the upload/extraction path also checks it.
Bill id alone permits reads, not host edits. `billQuery` deliberately remains
readable without the token, and query responses omit the host capability.
Verify mutation rejection directly, as well as the view-only UI.

### 4. Rescan + blank bill — IMPLEMENTED

Rescan is the first offer after a bad extraction. Blank-bill entry on `/`
uses `useManualBill` and `createBill`; manual entry on `/review` edits the
existing bill. Neither requires extraction to be available. Bill creation
still has its own per-device limit. Verify manual completion with extraction
disabled and after an extraction failure.

### 5. Analytics + Sentry — IMPLEMENTED (credentials and delivery unverified)

Cloudflare Web Analytics (no cookies, no consent banner) + Sentry for frontend
errors. Funnel events: landing -> scan started -> extraction ok/failed ->
published -> guest joined. Browser reporting is needed for render crashes,
camera permission failures, and in-app-browser problems that may never reach
the backend.

Cloudflare records public-page views and Web Vitals only; its Web Analytics
product does not support custom events. The six funnel milestones therefore go
to Sentry as allowlisted metrics, with no bill, share, device, participant, or
receipt data attached. Sentry replay, tracing, breadcrumbs, request data, and
user context remain disabled.

Measurement limit: `src/lib/observability.ts` counts each milestone once per
page load and remembers pending extractions only in that tab's memory. These
are aggregate activity counts, not a linked host-to-guest conversion funnel.
Reloads, repeated scans, and guests using other devices prevent interpreting
their ratios as exact conversion or extraction-success rates. Keep this limit
explicit when defining the launch review; no identity tracking is implied.

### 6. Legal copy + scan disclosure — IMPLEMENTED

Terms, privacy, and the scan disclosure describe cloud extraction, storage
cleanup, the 60-day inactivity TTL, link access, and local edit keys. Gateway
caching and deletion retries are described below. Mailbox operation and the
promised deletion-on-request workflow still require verification.

### 7. Cap tuning — IMPLEMENTED LIMIT; budget and alerting OPEN

`extractGlobalDaily` is 400/day and logs exhaustion with `console.error`.
A log entry is not proof that an alert reaches the operator. Verify an actual
notification and resolve the dollar-budget assumptions in open item 2.

### 8. Device walkthrough (not a formality)
Two real phones, real receipts including one bilingual: host path end-to-end on
iOS Safari, guest join on Android Chrome via a WhatsApp link. This is where the
actual launch blockers will surface.

## Open items

1. **Host access after storage loss — decision required.** Host edit keys live
   only in `billy:host-tokens`. A normal bookmark or saved share link cannot
   restore them. Explicitly accept unrecoverable host access with clear user
   messaging, or specify and verify a recovery mechanism before calling this
   resolved. No recovery feature has been selected. WebKit describes the ITP
   threshold as seven days **of Safari use without interaction with the site**,
   not seven elapsed days; home-screen web apps have an exemption. See
   [WebKit's explanation](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/).
2. **Spend bound — REOPENED 2026-09-05.** The listed Gemini 2.5 Flash-Lite
   rates ($0.10/M input, $0.40/M output) match
   [Google's pricing](https://ai.google.dev/gemini-api/docs/pricing).
   But $0.0007 per call is an estimate: `400 × 3 × $0.0007 × 30 = $25.20`
   is a scenario, not a verified worst case. `vision.ts` permits a model env
   override and sets no explicit `maxOutputTokens`; input and output sizes
   vary, and browser compression is not a server-enforced image-dimension cap.
   Record the production model, measured token usage across representative
   receipts, retry behavior, conservative request bounds, and a 31-day budget.
   Decide whether $30 covers Gemini alone or also hosting, storage, monitoring,
   and other operating costs; record headroom and the pause threshold.
3. **Bilingual receipt extraction.** Lebanese receipts are often Arabic/English
   mixed. If item names garble, the core feature fails for much of the target
   audience.

## External setup still required

- **Support email — OPEN.** `support@spolio.net` is in both legal pages.
  Verify inbound delivery, a reply, and a deletion request using a disposable
  test bill. Record who monitors the mailbox and the expected response time.
- ~~**og-image.png** had "Billy" rendered into it.~~ CLOSED 2026-09-04: replaced
  with a 1200x630 Spolio social card.
- ~~**landingSeo.image** needed an absolute production URL.~~ CLOSED 2026-09-04:
  canonical and image metadata now use `https://spolio.net` URLs.
- **Analytics credentials**: Cloudflare Web Analytics site token + Sentry DSN.

## Go/no-go checklist — added 2026-09-05

The dates and owner roles below are proposed planning defaults, not completed
assignments. Confirm a named owner for each gate. All gates are currently open;
record evidence against a release commit and production deployment before
marking them passed. An unresolved gate means no-go unless the launch owner
records an explicit, justified scope change or risk acceptance.

| Gate | Proposed owner | Due | Evidence required to close |
| --- | --- | --- | --- |
| Production release and rollback | Release operator (name TBD) | Sep 13 | Backend/frontend deployment identifiers, configuration checklist, build result, smoke-test result, and rollback rehearsal |
| Device and receipt acceptance | Tester (name TBD) | Sep 13 | Completed matrix below with devices, OS/browser versions, expected totals, actual results, and issue links |
| Spend controls and notifications | Operator (name TBD) | Sep 13 | Cost worksheet, production model, limits, received test alert, and pause/resume test |
| Analytics delivery | Operator (name TBD) | Sep 13 | Public-page measurement, all six milestone counts, and sanitized test error visible in production reporting |
| Host storage-loss decision | Launch owner (name TBD) | Sep 12 | Recorded choice, matching user copy, and storage-loss walkthrough |
| Support and deletion | Support owner (name TBD) | Sep 13 | Received/replied test email and completed test-bill deletion |
| Reddit launch preparation | Launch owner (name TBD) | Sep 14 | Communities/rules checked, final post/demo, posting time, response coverage, and review schedule |

### Production release procedure to complete and rehearse

- Record the release commit, intended Convex production deployment, Cloudflare
  Worker/domain, and previous working release identifiers. The current
  `pnpm deploy` builds and deploys Cloudflare only; it does **not** deploy Convex.
- Document and execute the Convex production deployment separately, including
  required components and crons. Confirm backend/frontend API compatibility
  and deployment order before releasing changes that affect both.
- Verify production configuration without recording secret values: the frontend
  `VITE_CONVEX_URL`, `VITE_SENTRY_DSN`, and
  `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN`; backend Gemini/AI Gateway settings,
  selected model, and extraction-pause state. Frontend `VITE_*` values must be
  present at build time. Confirm the frontend uses the intended production DB.
- Run `pnpm build`, deploy the frontend, then smoke-test `https://spolio.net`:
  landing -> scan -> review -> split -> publish -> guest join, plus manual entry,
  direct-link refresh, legal pages, and the actual shared link/social preview.
- Record exact rollback commands and targets for both services. Check that the
  previous frontend/backend pair can use the current stored data; do not assume
  rolling back code reverses data changes. Rehearse on a safe test deployment.
- Document the existing emergency brake: set `EXTRACTION_DISABLED=1` on the
  explicitly selected production Convex deployment. To resume, remove the
  variable; the code treats any nonempty value, including `"0"`, as disabled.
  Verify the friendly paused state, working manual entry, and successful resume
  on a safe test deployment before launch.
- Define who receives cap/extraction-failure alerts, through which channel, and
  when to pause scans or roll back. Trigger a controlled test and record receipt
  of the notification; do not exhaust the live paid quota just to test an alert.

### Device and receipt acceptance matrix

Record results on real iOS Safari for the host and Android Chrome plus the
WhatsApp in-app browser for guests. Opening a WhatsApp link in Chrome does not
also verify the in-app browser. Use disposable test bills and several receipts
covering English, mixed Arabic/English, USD-only, LBP-only, and dual totals.
Calculate expected results independently before comparing them with the app.

| Scenario | Pass condition |
| --- | --- |
| Scan and correct receipts | Names remain usable; quantities, prices, currency, and printed totals can be checked and corrected; ambiguous extraction is reviewable |
| Split arithmetic | Individual amounts, shared/fractional quantities, tax, service, tip, and LBP/USD conversion match expected values within documented rounding rules |
| Concurrent guests | Two guests claim/update items without overclaiming or silently losing accepted changes; host and guests converge on the same totals |
| Refresh and reconnect | Accepted edits survive refresh; offline/failed saves are visible; reconnect does not silently discard edits or duplicate claims |
| Camera and upload failure | Denied camera access and failed uploads give a clear next step; manual entry can complete a bill |
| Extraction failure and rescan | Failed extraction offers rescan and manual completion; manual editing on review keeps the same bill |
| Extraction paused or capped | Scanning explains the pause; a fresh manual bill can still be completed within its independent creation limit |
| Host and guest permissions | Missing/wrong host token rejects host mutations at the backend; copied host URLs render view-only; guests cannot edit another guest's claims |
| Share lifecycle | New guest can join from the shared link; revoked link fails; finalization stops claim edits while permitted settlement actions still work |
| Lost browser storage | Clearing site data produces the documented loss-of-access behavior; no message suggests an ordinary saved link restores host powers |

### Reddit launch and learning loop

- List the intended communities, check their current promotion rules, and record
  any required moderator approval before posting. Prepare the title, body,
  production link, and a short demo using a synthetic receipt.
- Set the September 15 posting time and timezone, assign someone to respond to
  comments/support, and reserve time to handle issues immediately after posting.
- Before posting, record baseline counters and numeric review thresholds for
  activity, reported failures, and spend. Define what would trigger investigation
  or a pause; use observed feedback and receipt-test results alongside metrics.
- Review after 24 hours (September 16) and seven days (September 22): aggregate
  landing/scan/extraction/publish/join counts, browser errors, support themes,
  observed receipt accuracy, and actual spend. These counts are not a linked
  conversion funnel; do not present them as unique users or exact success rates.
- Record findings, the next fixes with owners, and whether the launch claim or
  daily scan cap should change. Keep venue work outside this launch scope.

### Verification record

For each gate, append: `date | owner | commit/deployments | test or decision |
expected result | actual result | evidence link | pass/fail/open`.
The September 5 review inspected documentation and relevant code only. It did
not verify production credentials, build/deployment health, real devices,
mailbox delivery, deletion operations, or notifications.

## Consequence of the host token (decided, worth remembering)

Host capability now lives in localStorage (`billy:host-tokens`), not in the URL.
That closes the pasted-URL hole, but it also means an iOS Safari host who loses
storage to the 7-day ITP eviction can no longer recover edit access from a
bookmarked link — the bill becomes read-only to them. Before the change a
bookmark still carried full host powers. This is the right trade (the hole was
real and the recovery path was accidental), but it raises the stakes on open
item 1.

## Found during implementation (worth remembering)

- **Receipt-image retention is now bounded and logged safely.** AI Gateway
  payload logging is explicitly disabled. Convex deletes photos after success,
  rejection, or final failure; an hourly sweep also attempts to delete uploads
  once they are 24 hours old and retries deletion failures. The existing
  per-request 24-hour gateway cache cap remains disclosed as a privacy-vs-cost
  trade.
- **Host URLs without the local capability now render as view-only.** Review,
  split, and summary hide every host mutation affordance and offer the published
  guest route when one exists; backend token checks remain the authority.
- **Claim edits now count as bill activity for the 60-day TTL.** Claim rows keep
  their own activity timestamp so normal claim contention stays row-scoped, and
  the daily purge rolls the latest timestamp into the bill before deciding
  whether to delete it.
- **Manual entry reuses `createBill`** rather than adding a function: createBill
  only inserts a row and charges `createBillPerDevice`. The invariant "never add
  extraction gating to createBill" is documented at convex/bills/host/lifecycle.ts:52
  and src/hooks/useManualBill.ts:8 — breaking it silently removes the escape hatch
  in exactly the case it exists for.
- **The failure banner does NOT mint a second bill.** On /review the bill already
  exists, so "Enter items manually" dismisses the banner and edits in place.
  useManualBill is only for the landing page's new-bill flow, where no bill exists yet.
- **Sentry session replay must stay OFF** — it would record receipt contents,
  merchant names and the names of everyone at the table, and would falsify the
  privacy page. Same for `dataCollection.httpBodies`. Errors only.
- **Client error reporting does not cover every backend failure.** The global
  `MutationCache.onError` in `src/router.tsx` reports failed client mutations.
  Scheduled extraction failures can arrive later as bill state, and cron or
  storage-cleanup failures may occur with no browser open. Include those paths
  in the operational monitoring decision; verify service-plan availability and
  cost before selecting any additional integration.
