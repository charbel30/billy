# Launch plan — Spolio (public launch 2026-09-15)

Outcome of the 2026-09-01 grilling session. This is the cut line for the Reddit
launch: if it isn't here, it doesn't ship before 2026-09-15.

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
| Spend | $30/mo ceiling. Existing limiter stays; tune `extractGlobalDaily` down (~400) after verifying pricing. |
| Failure path | Rescan offered first, **blank-bill entry** as the floor beneath it. Both before launch. |
| Analytics | Cloudflare Web Analytics + Sentry (client-side). Convex event table deferred. |
| Root route | Hero -> prominent Scan CTA -> how-it-works below fold. Camera opens on tap only. `/scan` stays. |
| Legal | Short, truthful terms + privacy. Plus a one-line disclosure on the scan screen. |
| Language | English UI. Arabic **extraction** must still be tested. |
| Devices | Host: iOS Safari. Guest: must also work on Android Chrome + WhatsApp in-app browser. |

## Explicit non-goals

Accounts/auth - venue/business features - Arabic UI localisation - architecture
refactor - self-built analytics dashboard - desktop polish beyond "works".

## Work, in order

### 1. Quick wins — DONE
- Gate TanStack Router + React Query devtools out of production
  (`src/routes/__root.tsx:2,107-108` — currently imports the
  `/production` devtools build and mounts both unconditionally).
- Delete `public/tanstack.png` (starter leftover).
- Recompose `/`: hero, prominent scan CTA, how-it-works below the fold.
  Camera must not open on load — cold Reddit visitors meeting a permission
  prompt before an explanation is the single most costly conversion mistake
  available here.
- Cut or demote `VenueSection` — one page, one audience, one CTA.
- Fix `CLAUDE.md`: it still says `index.tsx` renders `ScannerHub`; it renders
  `LandingPage` as of ba81091.

### 2. Rename to Spolio — DONE (support email outstanding)
Landing copy, `content.ts`, SEO/meta, `site.webmanifest`, og-image, terms and
privacy text, and `src/lib/format/shareText.ts:44` ("split with Billy").
The share text is the only organic growth loop — every guest sees it, so it
must say Spolio and carry the join link.

### 3. Host token — DONE
Add a `hostToken` consumed by `makeBillMutation` / `billQuery` in
`convex/bills/lib/functions.ts`. Today the bill id in the URL *is* the host
capability (see the comment at line 27-28), so a pasted `/split/<id>` link
grants a stranger edit, revoke and finalize. Handlers stay untouched — the
builder seam exists exactly for this. No data migration needed.

### 4. Rescan + blank bill — DONE
Rescan as the first offer on a bad extraction; **blank-bill entry** as the
escape hatch. Rescan alone has a hole: it costs another paid call, burns the
same `extractPerDevice` bucket, and does nothing when the global cap trips or
vision is down. `createBill` is currently reachable only from
`src/components/features/scan/hooks/useScanUpload.ts:53`, inside the upload
flow, so there is no way to start a bill without a photo — which also means the
rate-limit message at `convex/lib/rateLimits.ts:26` promises manual entry that
does not exist.

### 5. Analytics + Sentry — DONE in code (credentials outstanding)
Cloudflare Web Analytics (no cookies, no consent banner) + Sentry for frontend
errors. Funnel events: landing -> scan started -> extraction ok/failed ->
published -> guest joined. Convex cannot capture render crashes, camera
permission failures, or in-app-browser quirks — it only sees requests that
succeeded.

Cloudflare records public-page views and Web Vitals only; its Web Analytics
product does not support custom events. The six funnel milestones therefore go
to Sentry as allowlisted metrics, with no bill, share, device, participant, or
receipt data attached. Sentry replay, tracing, breadcrumbs, request data, and
user context remain disabled.

### 6. Legal copy + scan disclosure — DONE
Rewrite `src/routes/terms.tsx` and `privacy.tsx`: short, plain, accurate.
Photo goes to Google (Gemini) via Cloudflare and is deleted after extraction;
extracted text is retained; 60-day TTL (`convex/crons.ts`); anyone with the
link can view. Add one line on the scan screen itself — that is the disclosure
that earns the tap.

### 7. Cap tuning — DONE (400/day, + console.error on trip)
Set `extractGlobalDaily` to fit $30/mo with headroom once real pricing is
known. Alert when it trips.

### 8. Device walkthrough (not a formality)
Two real phones, real receipts including one bilingual: host path end-to-end on
iOS Safari, guest join on Android Chrome via a WhatsApp link. This is where the
actual launch blockers will surface.

## Open items

1. **iOS 7-day storage eviction.** Safari ITP clears script-writable storage
   after ~7 days of no interaction. Host identity is localStorage only
   (`billy:bill-history`, `billy:device-id`), so hosts may lose bills after a
   week while the server keeps them 60 days. Biggest retention leak; may add a
   "save your link" step to the summary screen. (User checking.)
2. ~~**Gemini pricing.**~~ CLOSED 2026-09-01: $0.10/M input, $0.40/M output.
   ~$0.0007 per extraction; retrier (maxFailures 3) triples the worst case.
   Cap set to 400/day => ~$25/mo worst case. 1000/day would have been ~$63/mo.
3. **Bilingual receipt extraction.** Lebanese receipts are often Arabic/English
   mixed. If item names garble, the core feature fails for much of the target
   audience.

## Blocked on the user

- ~~**Support email.**~~ Set to support@spolio.net in both legal pages.
  ACTION: the mailbox must actually exist and be monitored before launch — the
  privacy page promises deletion-on-request through it.
- ~~**og-image.png** had "Billy" rendered into it.~~ CLOSED 2026-09-04: replaced
  with a 1200x630 Spolio social card.
- ~~**landingSeo.image** needed an absolute production URL.~~ CLOSED 2026-09-04:
  canonical and image metadata now use `https://spolio.net` URLs.
- **Analytics credentials**: Cloudflare Web Analytics site token + Sentry DSN.

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
  useManualBill is only for the scan screen, where no bill exists yet.
- **Sentry session replay must stay OFF** — it would record receipt contents,
  merchant names and the names of everyone at the table, and would falsify the
  privacy page. Same for `dataCollection.httpBodies`. Errors only.
- **Convex's native Sentry integration is Pro-only** ($25/mo, most of the budget).
  Not needed: the global `MutationCache.onError` in src/router.tsx already sees
  every Convex mutation failure client-side, so the free browser SDK covers
  backend errors as users actually experience them.
