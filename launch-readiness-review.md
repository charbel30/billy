# Spolio production and announcement readiness

Reviewed September 9, 2026 against commit `be9c595` and read-only checks of the public site.

## Recommendation

**I would not announce Spolio as production-ready on Reddit yet.** The consumer product has enough scope to launch: scanning, correction, individual and shared claims, LBP/USD amounts, live invitations, finalization, and manual entry are present. The remaining work is mostly correctness, access control, and release verification. Another design pass or a larger feature list is unlikely to move readiness as much as fixing these issues.

Two access-control defects are immediate blockers: a guest can obtain another guest's edit credential from a bill response, and share-link revocation does not remove a previous viewer's ability to read the bill. Local diagnostics also reproduced extraction overwriting a finalized bill and acceptance of invalid monetary metadata. Save feedback and rapid claim interactions need correction and browser verification.

My suggested progression is: fix the trust and data-integrity issues, run a small supervised beta on real phones, then make a focused public announcement once the release gates below pass. Calling the current app a beta would not excuse the access-control defects.

The September 15 date in [launch-plan.md](./launch-plan.md) remains possible only if that evidence is collected in time. This review is an assessment, not a change to the agreed release scope or date.

## What this review establishes

| Area | Assessment | Evidence and limits |
| --- | --- | --- |
| Product scope | Sufficient for a first consumer release | Complete workflow exists in source; no real-phone walkthrough performed here |
| Build health | Pass | Production Vite build and TypeScript check exit successfully; separate Convex TypeScript check also passes |
| Public site | Reachable | Homepage, privacy, terms, social image, manifest, and robots file return HTTP 200 |
| Host write protection | Useful protection present | Host token stripped from query output; wrong host token rejected in local handler check |
| Guest isolation and revocation | Blocked | Both defects reproduced against actual source handlers using an in-memory database adapter |
| Receipt/save integrity | Blocked | Finalized overwrite and invalid metadata reproduced; save-state and stale-claim problems traced in source |
| Monetary calculation | Partially verified | Ordinary subtotal/service/tip example passes; zero-claim proportional service case fails reconciliation |
| Scanning quality | Unverified | No real Gemini calls, real receipt corpus, bilingual accuracy measurements, or latency measurements |
| Production operations | Unverified | Dashboard settings, backend release identity, alerts, budget, rollback, and support delivery not inspected |
| Launch preparation | Incomplete evidence | Positioning and brand assets exist; no verified posting permissions, demo acceptance, or operator coverage |

The repository was clean at the start. No application behavior, cloud configuration, bills, or deployments were changed. The public-site checks accessed public pages/assets only. No production security probes, scans, bill creation, support emails, or Reddit posts were performed.

The deployed homepage references a different entry asset from the local build. That does not establish a defect, but it means the reviewed commit has **not** been matched to the deployed frontend/backend pair. Findings below apply to the reviewed source; public deployment exposure still needs confirmation.

## What is already in good shape

Spolio has a clear reason to exist: splitting a Lebanese restaurant receipt using dollars, lira, and the table's exchange rate. The landing page communicates that purpose, offers scanning immediately, and has a sample bill for people arriving without a receipt. Manual entry provides a useful alternative when the paid extraction path is unavailable. See [landing content](./src/components/features/landing/content.ts), [scan actions](./src/components/features/scan/ScanReceiptActions.tsx), and [manual entry](./src/hooks/useManualBill.ts).

There are meaningful protections already implemented: separate host capabilities, backend checks on host mutations, claim-availability calculations, an extraction quota and pause switch, retry handling, image cleanup, and a bill inactivity TTL. These deserve credit as implemented mechanisms; they still need acceptance tests and production evidence. See [function builders](./convex/bills/lib/functions.ts), [rate limits](./convex/lib/rateLimits.ts), [extraction](./convex/bills/extraction.ts), and [cleanup jobs](./convex/crons.ts).

The product also includes the small essentials often missing from first launches: legal pages, scan disclosure, finalization confirmation, leftover handling, read-only notices, share text, QR codes, production metadata, and devtools excluded from production. These observations come from source inspection and public HTML, not a visual or accessibility certification.

## Confirmed defects and release priorities

Here, **P0 means fix before exposing the app to a wider audience**. **P1 means resolve before the production announcement**, including collecting the specified verification. These priorities describe this launch, not evidence of a current incident.

### P0 — Guest edit credentials are returned to everyone viewing a bill

`toWireBill` removes `hostToken`, but leaves `people[].guestSessionId`. Both host and guest queries use that serialization. Guest mutations accept a supplied session ID, and `assertOwnPerson` authorizes edits by comparing it with the person's stored session ID.

A viewer can therefore copy another participant's session ID from a response and submit a claim or paid-state update as that participant. `joinSplit` can also rename an existing person for a supplied matching session. Hiding another person's buttons in the UI does not protect these operations.

**Local result:** called the real guest query handler with synthetic data, took the returned person's session credential, and called the real guest claim handler with an empty claim list. The other participant's claim was removed. A wrong, unknown session was rejected, confirming that disclosure of the accepted credential is the problem.

**Required outcome:** public bill data must not contain anyone's edit secret. Return public participant information and an appropriately scoped indication of which people the current caller controls. Existing exposed guest credentials need a rotation/invalidation strategy when deploying the fix; stripping future responses alone cannot retract credentials previously received.

**Acceptance:** two independent guest sessions can read the table; neither can rename, clear claims, or mark paid for the other using anything learned from public responses. Check JSON and server-rendered/hydration data as well as the UI. Preserve companion management for the caller's own people.

Evidence: [serialization and ownership checks](./convex/model/bills.ts), [person schema](./convex/schema.ts), [guest query](./convex/bills/guest/queries.ts), [guest claims](./convex/bills/guest/claims.ts), [guest people](./convex/bills/guest/people.ts), [join ownership UI](./src/components/features/join/JoinPage.tsx).

### P0 — Revoking a share link does not revoke a previous viewer's access

The guest query returns the bill's stable `_id`. The host-side `getBill` query requires only that ID and returns the current `shareToken`. `revokeShare` rotates the share token and returns the bill to `READY`, but does not change this alternate read path.

**Local result:** the old share token stopped resolving after revocation, but querying with the previously learned bill ID still returned the receipt and replacement share token. Reads remain possible while unpublished; guest writes become possible again after republishing with the discovered replacement token.

This undermines the intended access revocation described in the privacy/terms pages and the launch plan. It is not a claim that an attacker can enumerate arbitrary bill IDs, and revocation can never erase copies of data already downloaded. The defect is continued server access to the bill and its future updates.

**Required outcome:** ensure every read path respects the intended host/share capability and revocation semantics. Host-page SSR needs to work within that access model. The rationale in the current `billQuery` comment overlooks that a share viewer can learn the stable ID before revocation.

**Acceptance:** save every identifier returned to a guest, revoke, then attempt both query families and direct route refreshes. No old credential or learned public identifier should expose new receipt data or the replacement token. A newly invited guest must still work.

Evidence: [read builders](./convex/bills/lib/functions.ts), [host query](./convex/bills/host/queries.ts), [revokeShare](./convex/bills/host/lifecycle.ts), [privacy promise](./src/routes/privacy.tsx).

### P1 — A late extraction can replace a finalized receipt

`prepareImageExtraction` checks the host token and upload but does not reject finalized bills. `applyExtraction` checks only that the image reference still matches. It then replaces line items, changes status to `PENDING` or `NEEDS_REVIEW`, and deletes existing claims, regardless of the bill's current lifecycle state.

**Local result:** supplying a matching extraction result to a synthetic `FINALIZED` bill changed its status to `PENDING`, replaced its line item, and deleted its claim.

One reachable risk is a slow scan followed by manual editing, splitting, and finalization before the scan completes. The review editor remains available while extraction is pending. A late result can also replace manual corrections or move a published split out of its live state. Frequency on real devices was not measured.

**Required outcome:** define when extraction results are still allowed to apply, reject invalid rescan states, and protect edits made since a run began. Check both scheduling and completion; a scheduling-only check does not protect a bill finalized during the request.

**Acceptance:** start extraction, make manual changes and finalize, then release the delayed result. Preserve the agreed manual/finalized data and still clean up the image. Also cover replacement scans and extraction failure.

Evidence: [upload preparation](./convex/bills/host/uploads.ts), [applyExtraction](./convex/bills/extraction.ts), [review editor](./src/components/features/review/ReviewPage.tsx).

### P1 — Claim taps can silently replace earlier accepted choices

**Implementation update (September 10):** host and guest taps now send an item/person delta, which Convex applies to the current claim rows in one transaction. The obsolete whole-person replacement endpoints were removed. Guest even-sharing is also atomic and preserves other items and other sessions' claims. The repeated “Saving split...” / “Saving claim...” text and pending pulses were removed; conflicts and failed requests still show feedback. Host finalization waits for all outstanding local claim, sharing, person, and tip writes and prevents new edits while finalizing.

**Verification:** the original host and guest stale-list cases failed locally before switching to the new mutation calls. Regression tests cover both items surviving, repeated increments/decrements, changing participant, capacity conflicts, guest sharing/ownership, finalization locks, and overlapping/failed pending writes. A browser walkthrough with added network latency remains outstanding. Deploy the backend and frontend together; already-open clients using the removed endpoints must reload. This update resolves this code finding only, not the other launch blockers below.

The following describes the reviewed version before that fix:

Host and guest `stepClaim` build a replacement list of all claims for one person from the latest rendered `bill.claims`. The backend treats this as that person's complete new list. The pending indicator does not disable claim buttons or serialize all edits for the person.

Two taps before the subscription updates can submit two lists based on the same old snapshot. For example, tapping meal A and then drink B can submit `[A]`, then `[B]`; B replaces A. Rapid taps on the same item can also submit the same quantity twice.

**Local result:** passing those two stale-snapshot requests through the real `saveClaimsForPerson` calculation leaves only B, with `rejectedCount: 0`. The browser timing scenario is source-derived and still needs a throttled-browser reproduction.

**Required outcome:** preserve the user's sequence of claim changes through pending requests and live updates, or prevent conflicting input while a relevant write is pending. Make finalization wait for pending claim decisions as well.

**Acceptance:** under added latency, tap two different items quickly, increment one item repeatedly, change active participant, and immediately finalize. Every acknowledged choice must survive or be explicitly rejected.

Evidence: [host split page](./src/components/features/split/SplitPage.tsx), [guest page](./src/components/features/join/JoinPage.tsx), [claim buttons](./src/components/features/bill/claims/ClaimListItem.tsx), [replacement-list calculation](./convex/model/bills.ts).

### P1 — “Saved” does not mean the save succeeded

`SaveStatus` shows “Saved” whenever `saving` changes from true to false. That transition also occurs after a failed mutation. `useBillEditor` keeps a dirty flag after failure, but the indicator is not given that information. Before the debounce fires, there is also no persistent unsaved state.

There is a related recovery hazard: a successful older request unconditionally calls `clearWorkingBill(id)`. If the user made a newer edit while that request was pending, it can erase the newer local recovery copy. Server pushes and overlapping flushes need a deliberate acknowledgement model. These timing hazards were inspected in source, not reproduced in a rendered browser.

**Required outcome:** distinguish unsaved, saving, saved, and failed states. An acknowledgement may clear only the version of the local work that it actually saved. Surface the existing `editedElsewhere` signal where users can act on it; it is currently returned by the hook but unused by the feature pages.

**Acceptance:** fail a save and check that “Saved” never appears; edit during a delayed save, close the tab after the first acknowledgement, and reopen. The newer edit must be recoverable. Check offline/reconnect and multiple host tabs.

Evidence: [SaveStatus](./src/components/features/review/components/SaveStatus.tsx), [editor coordinator](./src/hooks/useBillEditor.ts), [working storage](./src/lib/bill/storage.ts).

### P1 — Numeric metadata can produce invalid settlement amounts

`saveWorking` validates items and people but copies metadata directly into the bill. `metaValidator` checks number types, not positive exchange rates or nonnegative charges. The client validity check also omits metadata. The rate input uses a parser that permits negative values and turns blank/invalid input into zero.

**Local result:** an authenticated host save with `rate: -1` and `tax: -100` was accepted by the actual handler. This is not a host-authorization bypass; it is missing domain validation that ordinary input can reach. A zero rate produces $0 amounts and a negative rate produces negative USD amounts.

**Required outcome:** validate finite positive exchange rates, supported currency semantics, nonnegative service/tax/printed totals, and reasonable size/range limits at the server. Keep the client feedback aligned. Validate extracted data before it becomes a usable bill; structured output types alone do not ensure sensible prices or quantities.

**Acceptance:** blank, zero, negative, nonfinite, and extreme values either receive actionable validation or are handled by an explicitly supported rule. Invalid metadata must never reach a finalized summary.

Evidence: [saveWorking](./convex/bills/host/lifecycle.ts), [validators](./convex/bills/lib/validators.ts), [client validity](./src/lib/bill/working.ts), [number parsing](./src/lib/format/number.ts), [currency conversion](./src/lib/money/currency.ts).

### P1 — Proportional service allocation fails when nobody has claimed anything

`computePortfolios` assigns no proportional service shares when the claimed subtotal is zero, but still includes all service/tax in its rounding target. `roundToTarget` can add at most one lira per person, so it cannot reconcile that mismatch.

**Local result:** one person, no claims, and 90,000 LL of enabled proportional service produces a **1 LL** total. With multiple people it can produce a few lira instead of an intentional zero/unallocated/full-charge outcome. The UI permits finalization with unclaimed items, so this edge case has a route into a final receipt.

**Required outcome:** decide what service/tax means when no priced items are claimed, implement that rule explicitly, and make the summary explain unallocated amounts. Define USD cent rounding separately from integer-LBP reconciliation.

**Acceptance:** independently calculate no-claim, zero-price, partial-claim, fractional, even-service, proportional-service, and tip examples. Person totals must reconcile to the documented payable amount, including any deliberate unallocated amount.

Evidence: [split math](./src/lib/money/split.ts), [finalize-as-is flow](./src/components/features/split/SplitPage.tsx), [summary rendering](./src/components/features/bill/summary/BillSummary.tsx).

### P1 — Browser-storage failure can silently remove host access

Host capabilities are intentionally stored only in the originating browser. That product decision is already disclosed in the legal pages and does not require adding accounts. The immediate defect is different: `rememberHostToken` catches storage errors and returns normally, so scan/manual/sample flows can navigate onward without having retained the only usable client copy. Guest session storage has no error handling and can throw during mounting.

**Local result:** a storage adapter throwing from `setItem` was silently ignored; `getHostToken` then returned an empty string.

**Required outcome:** detect failure to retain access and offer a clear next step. Decide how to handle temporary in-memory access, if supported, and explain permanent browser-storage loss near creation/sharing as well as in legal copy. An ordinary bookmark must not be described as recovery.

**Acceptance:** blocked storage, quota failure, private browsing, clearing site data, and a second device produce an intentional, understandable experience. A guest storage error must not crash the join flow.

Evidence: [host token storage](./src/lib/session/hostToken.ts), [guest session storage](./src/lib/session/guestSession.ts), [scan flow](./src/components/features/scan/hooks/useScanUpload.ts), [manual flow](./src/hooks/useManualBill.ts).

## Production evidence still missing

### Release identity, monitoring, and rollback

`pnpm deploy` builds and deploys the Cloudflare frontend. It does not deploy Convex. Record the release commit, frontend deployment, backend deployment, components/crons, and production configuration together. Build-time `VITE_*` values must point to the intended production services. The example environment file still describes a shared starter backend; do not use that text as a production setup guide.

The live homepage HTML did not include the configured Cloudflare beacon script. That is evidence to investigate, not proof that no analytics run: browser injection and dashboard configuration were not inspected. Sentry delivery likewise remains unverified. Existing milestones are counts once per page load, not a linked conversion funnel; repeat scans, reloads, and different guest devices make conversion ratios unreliable.

Before announcing, demonstrate a sanitized browser error arriving in Sentry and a backend extraction/cleanup alert reaching the operator. Record release identifiers so reports can be tied to deployed code. A console log about an exhausted quota is not evidence of a delivered notification. Rehearse restoring a known-compatible frontend/backend pair on a safe deployment.

Evidence: [deployment scripts](./package.json), [Cloudflare config](./wrangler.jsonc), [observability](./src/lib/observability.ts), [analytics script](./src/routes/__root.tsx), [existing release checklist](./launch-plan.md).

### Spend and anonymous traffic

The 400-extractions/day limit bounds accepted extraction starts, not every operating cost. Per-device IDs are caller-controlled. Upload URL creation and bill creation have no equivalent global ceiling in the inspected code. The 2 MB attachment check runs after upload; it cannot prevent storage use from an upload that is never attached. Cleanup helps retention but does not prevent burst costs or availability loss.

The existing estimate of $0.0007 per call gives `400 × 3 × $0.0007 × 31 = $26.04` in a 31-day month, before other services. It is a scenario, not a verified maximum: the model is configurable, output tokens are not explicitly capped, and the code does not record actual token usage. Google's current standard Gemini 2.5 Flash-Lite prices are $0.10/M input and $0.40/M output tokens. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing).

Record actual production model/tier, input/output usage, retry counts, maximum accepted receipt size/dimensions, and all-service costs. Define global abuse limits and a pause threshold appropriate to the budget. Prove that pausing extraction preserves manual entry. Do not simply raise the cap for Reddit traffic without this worksheet.

The Gemini pricing page also distinguishes free-tier and paid-tier use of submitted content for product improvement. Verify the actual provider tier/settings and make the privacy description match; deleting the app's stored photo does not establish deletion behavior at every processor. [Google pricing and data-use distinctions](https://ai.google.dev/gemini-api/docs/pricing).

Evidence: [rate limits](./convex/lib/rateLimits.ts), [uploads](./convex/bills/host/uploads.ts), [vision request](./convex/extraction/vision.ts), [retrier](./convex/lib/retrier.ts).

### Privacy, support, and indexing

Verify that `support@spolio.net` receives mail, that someone replies, and that a disposable deletion request removes the bill and related claims/images. Document how to authorize deletion requests, including when a host never published a share link. This is operational verification of the app's promises, not a legal-compliance certification.

No route-level `noindex` was found for bill/share pages. The live Cloudflare-managed robots file allows general search crawling. Add appropriate indexing directives for personal bill routes and verify them on a synthetic bill, while retaining the public landing page's discoverability. `noindex` is a search instruction, not access control; Google must be able to read it for it to take effect. [Google indexing guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Public HTML responses had no explicit Content-Security-Policy or Referrer-Policy headers. Evaluate these alongside the capability fixes and third-party scripts; their absence alone is not proof of an exploit. The join preview currently includes a merchant and item subtotal, so decide whether that is the intended disclosure and label the subtotal accurately when tax/service/tip changes the final amount.

### Automated checks and capacity

No project test suite, test command, or committed CI workflow was found. A passing build cannot catch the permission and state-transition failures reproduced here. Add a small, durable regression suite for these defects plus money invariants, lifecycle transitions, cleanup, and two-session behavior. Run it and the build as a release gate. A current dependency-advisory review remains outstanding; this assessment did not establish dependency security.

Keep scale testing proportionate: two guests competing for the last unit, a busy table, and a modest burst of unrelated tables. Claims are separate rows, but each claim update reads all of the bill's claims and the diff operation reads them again. That means row writes do not prove conflict-free operation across an entire table. Convex checks transaction reads for conflicts; actual contention needs measurement. [Convex transaction behavior](https://docs.convex.dev/database/advanced/occ).

The source describes item/people arrays as bounded, but bulk `saveWorking` does not enforce an array-length cap, and claim loading uses `.collect()`. Define enforceable limits so cleanup and mutation work fit the intended worst case. Avoid an architecture rewrite without measured need.

Evidence: [claim persistence](./convex/model/claimRows.ts), [schema](./convex/schema.ts), [bulk validation](./convex/model/bills.ts), [package scripts](./package.json).

## Minimum acceptance session

Use disposable bills and receipts whose expected totals were calculated independently. Suggested initial corpus: 15–20 receipts across English, mixed Arabic/English, USD-only, LBP-only, dual totals, service/tax, long receipts, blur, and glare. This is a practical launch sample, not a statistically established accuracy benchmark.

| Exercise | Required result |
| --- | --- |
| First-time host on iOS Safari | Scan, review/correct, claim, invite, finalize, share totals without coaching |
| Guest on Android Chrome and WhatsApp in-app browser | Open link, join, claim, reload, mark paid; test the in-app browser separately |
| Three people sharing a fractional item | All quantities and totals reconcile under a written rounding rule |
| USD-only receipt and rate correction | Original dollar amounts remain interpretable; host understands which amount is authoritative |
| Receipt with tax/service and default tip | Charges are visible and intentional; no double-counting; test 0% and default 10% tip |
| Rapid taps and simultaneous guests | No silent accepted-claim loss and no overclaiming; host/guest totals converge |
| Failed save and reconnect | Error remains visible; retries/reload preserve unsaved work; no false “Saved” |
| Delayed extraction and manual edits | A late result cannot replace accepted edits or a finalized bill |
| Failed scan, paused scanner, rejected upload | Each gives a clear next action; manual completion still works |
| Revocation and credential isolation | Old viewers cannot fetch future data or replacement capabilities; guests cannot impersonate others |
| Site data blocked or cleared | Explain loss of access; no silent lockout or guest crash |
| Direct route refresh and invalid/expired link | Appropriate state instead of an unexplained framework error |
| Small screen, large text, keyboard, reduced motion | Primary actions remain usable and focus/labels make sense |

Record device/browser versions, receipt category, expected amounts, actual amounts, time to a corrected usable split, and whether help was needed. Every tested split must be correct after review. If a receipt cannot be scanned, the fallback must still complete it. Do not announce “works with any receipt” or a time/accuracy percentage without evidence.

## Reddit and announcement preparation

The strongest angle is the concrete local problem: friends claiming what they ordered from a Lebanese receipt, with amounts in both dollars and lira and no signup. The sample bill is important because many Reddit visitors will be browsing away from a restaurant. Verify its entire flow as carefully as a scan.

Start with one relevant community and be available to respond. `r/lebanon` is a plausible audience to investigate; `r/SideProject` would provide a different kind of feedback, mainly from builders. These are candidates, not verified posting permissions. Both rule URLs redirected to moderator pages without usable rule text during this review, so their current self-promotion requirements remain unverified: [r/lebanon rules](https://www.reddit.com/r/lebanon/about/rules/), [r/SideProject rules](https://www.reddit.com/r/SideProject/about/rules/).

Reddit's current guidance prohibits repeated or unsolicited mass engagement and leaves community-specific spam decisions to moderators. Check the chosen community's current rules, disclose that you built the app, and ask moderators if the rules leave the post's acceptability unclear. Do not mass-post the same promotion. [Reddit spam policy](https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam).

Prepare a 20–30 second demo with a synthetic receipt showing scan/review → two people claiming → shared totals. Include the manual/sample option, a visible way to report a problem, a tested production link, and the actual mobile share preview. Avoid real participant information in launch media.

Suggested post **after the gates pass**, adapted to the community's rules:

> I built Spolio to make splitting restaurant bills in Lebanon less annoying.
>
> You scan the receipt, check the items, and each person picks what they had. It shows amounts in LBP and USD, and you can send a live link in the group chat. There's no signup or install, and there's a sample bill if you just want to try it.
>
> Receipt reading can make mistakes, so please check the numbers before settling. It calculates shares; payments happen outside the app.
>
> I'd especially like feedback on receipts it struggles to read and anything confusing when joining from WhatsApp: https://spolio.net

Do not share this review's credential findings publicly as launch content while they remain unresolved. Keep the announcement focused on what people can use and what feedback would help.

For the first 24 hours, schedule comment/support coverage and watch scan failures, bill completion complaints, browser errors, and spend. Review again after seven days. Proposed incident triggers: any confirmed cross-guest access, revoked-link access, or finalized-data overwrite stops expansion immediately; repeated identical scan failures prompt a receipt/provider investigation; reaching the agreed spend threshold pauses scanning. These are proposed operator rules, not configured alerts.

Use aggregate milestones as activity indicators, alongside observed beta completion and support reports. A smaller audience that completes real splits gives better product evidence than a large click count. Exact conversion and retention claims require measurement the current analytics do not provide.

## Release sequence and stop conditions

| Order | Work | Completion evidence |
| --- | --- | --- |
| 1 | Repair guest isolation and revocation, including existing credentials | Automated two-session negative tests; no secrets in public query/SSR responses |
| 2 | Repair extraction lifecycle, claim sequencing, save acknowledgements, money validation, zero-claim math, and storage failure | Regression checks plus delayed/failing-network walkthrough |
| 3 | Establish the release pair and operational controls | Named operator, release IDs, model/budget sheet, delivered alerts, tested pause/resume and rollback |
| 4 | Run supervised beta and receipt/device matrix | Recorded results with no unresolved trust/data-integrity failure; users complete the flow without coaching |
| 5 | Confirm support, privacy behavior, indexing, and launch materials | Test deletion, mailbox response, synthetic share preview, usable demo, community rules checked |
| 6 | Announce and review | Response coverage, baseline metrics/spend, next-day and seven-day review notes |

Assign names to the operator/tester/support roles; one founder can own all three, but every gate still needs evidence. Do not compress verification solely to preserve September 15. If the gates are still open, move the announcement or continue supervised testing.

**What can wait:** accounts, payments, venue dashboards, Arabic UI localization, a live exchange-rate feed, native apps, an elaborate analytics system, and further visual redesign. Arabic receipt quality cannot wait if the public positioning is Lebanese receipts. Host-storage recovery can remain out of scope if the behavior and limitations are clear and storage failures are handled.

## Verification record from this review

- `pnpm build`: passed. The first run also logged a sandbox-related Wrangler log-file warning despite exit 0. Re-running with `WRANGLER_LOG_PATH=/tmp/spolio-readiness-wrangler.log` passed without that warning. No deployment command ran.
- `pnpm exec tsc --noEmit -p convex/tsconfig.json`: passed.
- Offline source diagnostics: guest impersonation, revocation bypass, finalized extraction overwrite, negative metadata acceptance, zero-claim service rounding, and silent host-storage failure reproduced. Wrong-host and unknown-guest rejection and an ordinary subtotal/service/tip example passed.
- The diagnostics used actual function handlers with a synthetic in-memory database adapter. They did not emulate Convex argument/return validation, transaction concurrency, subscriptions, storage services, or production. Browser timing findings are explicitly identified above.
- Temporary diagnostic script: `/tmp/spolio-readiness-checks-2026-09-09.ts`; run with `bun /tmp/spolio-readiness-checks-2026-09-09.ts` in this workspace. It has no network calls and uses synthetic data. It is an investigation artifact, not the missing durable regression suite. The behavioral scenarios above remain the permanent reproduction record.
- Read-only HTTPS checks around 19:02–19:04 UTC: `/`, `/privacy`, `/terms`, `/og-image.png`, `/site.webmanifest`, `/robots.txt` all returned 200. Branding/scan/sample copy exists in public HTML; manifest uses Spolio. This does not verify interactivity or authenticated/guest flows.
- No real-device browser run, accessibility audit, provider extraction, load test, dashboard inspection, email delivery, dependency-advisory audit, or production release mapping was completed. These remain open, not assumed failures.

The architecture review method focused attention on the active schema, join/split, extraction, and editor modules. Its useful conclusion here is to strengthen the existing capability and save-state seams; it does not justify broad refactoring before launch. A temporary visual appendix is available at `/tmp/architecture-review-spolio-2026-09-09.html`.
