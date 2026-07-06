# Billy — Production Roadmap & Go-To-Market (Lebanon)

The plan for taking Billy from working MVP to a launched product with paying venues.
Strategy decided 2026-07: **venue-led, dual-track** — the free consumer splitter is the
viral funnel; a venue subscription ("Billy for Venues": QR table sessions) is the revenue
engine and the pitch centerpiece.

> **Status (2026-07-05): Phase A is 8/10 shipped** — rate limiting + kill switch, legal
> pages, extraction-failure UX, token revoke + guest cap + TTL cron, QR codes, photo
> preview, WhatsApp totals export, demo bill, and `/join` OG previews are live (deployed
> to the dev Convex; `pnpm build` + `tsc` clean). Remaining before public launch:
> analytics/Sentry (needs account keys) and the marketing landing page. See the phase
> checklists in §7 and the per-item notes in §2. Phase B has started: mark-as-paid
> (IDEAS §1, trimmed scope) shipped 2026-07-06, and the guest `/join` page now shows
> the whole table read-only (guests act only on their own people).

This document is the single source of truth for: what to polish, what to build for venues,
how to price it, and how to market it in Lebanon. Implementation happens against the
checkbox lists in §7. Deeper product ideas and pitch material from the 2026-07 code
walkthrough live in [`IDEAS.md`](./IDEAS.md); the highest-value ones are already folded
into the phase lists below.

---

## 1. Vision & positioning

### The two-sided model

| Track | Who | Costs them | Job it does |
|---|---|---|---|
| **Billy (consumer)** | Friends splitting a bill | Free forever | Scan any receipt, split item-by-item, share a live link — no install, no account |
| **Billy for Venues** | Restaurants, bars, clubs | Subscription (USD/mo) | Staff scans the check → table QR → guests claim their own items and see their totals in LBP+USD |

The consumer product is the marketing for the venue product: **every published bill puts a
`/join` link in front of 4–8 new people**, and every venue table session does the same at
scale. The guest page is the billboard ("powered by Billy" + a "split your own bill" CTA).

### Why Billy wins in Lebanon

1. **Dual-currency at the venue's real rate.** Receipts print both `TOTAL LL` and `TOTAL $`;
   Billy derives the actual charged rate from the paper (`src/lib/currency.ts`). No other
   splitter does this.
2. **No-install web links.** You cannot get a whole Lebanese table to install an app; a
   WhatsApp-able link works for everyone.
3. **The pay-at-table category is proven and Lebanon is an open gap.** qlub (UAE/KSA) and
   Sunday (Europe/US, $21M Series B) validated QR itemized-split at the table — neither
   operates in Lebanon. Their moat is per-POS integration; Billy's wedge is needing **zero
   POS integration** (see §3).

### Competitive snapshot

| Product | Itemized split | Dual LBP/USD | Needs POS integration | In Lebanon |
|---|---|---|---|---|
| qlub, Sunday | ✅ | ❌ | ✅ (their whole cost structure) | ❌ |
| Splitwise & co. | ❌ (manual entry, no receipt scan) | ❌ | — | usable but wrong tool |
| Calculator + WhatsApp screenshot | 😩 | manual | — | the actual incumbent |
| **Billy** | ✅ scan → claim | ✅ venue rate | ❌ (scan the printout) | ✅ |

### POS landscape research (2026-07, why "zero integration" is the strategy)

- **Omega Software** (~78% Lebanese market share) and **BIM POS** — the two dominant local
  hospitality POS vendors — have **no public API, no webhooks, no developer program**.
  Integrations are bespoke partnership deals via their sales teams. Not a launch path.
- **Foodics** (Saudi, 30k+ MENA restaurants) has a real developer portal
  (developers.foodics.com) with OAuth partner onboarding, an app marketplace, and a
  dedicated **pay-at-table integration guide**. Small Lebanon footprint, but it is the one
  self-serve integration → **Phase C**.
- **Every POS already prints an interim check on demand.** That printout is our
  integration surface: staff scans it, and re-scans an updated one later (§3 merge).
  Printer interception (ESC/POS tap) was researched and deferred — hardware + on-site
  complexity for marginal gain over re-scanning.
- Omega/BIM become *partnership pitches* once we have venues live: "your competitors'
  merchants get this feature; your merchants can too."

---

## 2. Launch blockers — consumer app hardening (priority order)

What must ship before pointing the public (and pilot venues) at the app. Current state
verified 2026-07 against the codebase.

### 2.1 Rate limiting on the extraction pipeline — ✅ shipped (was the #1 risk)
Implemented with `@convex-dev/rate-limiter` (`convex/lib/rateLimits.ts`,
`convex/convex.config.ts`). Scan mutations now require a `deviceId` (persistent anonymous
id, `src/lib/deviceId.ts`) and enforce:
- per-device token buckets (~12 scans/hour on upload + extract, 30 bills/hour on create);
- a **global daily budget of 1,000 extractions** — the real backstop against key rotation;
- kill switch: `npx convex env set EXTRACTION_DISABLED 1` pauses scanning with a friendly
  ConvexError surfaced in the scanner UI.

### 2.2 Legal pages — ✅ shipped
`/privacy` + `/terms` routes (`src/routes/privacy.tsx`, `src/routes/terms.tsx`): plain-
language cloud-OCR disclosure, delete-after-extraction, 60-day retention, Law 81/2018
note, fair-use clause. Linked via `LegalFooter` on the scanner and guest pages.
- ⚠️ The contact email is a **placeholder** (`billy.leb@gmail.com`) — set the real one.
- Still to do before charging money: confirm Law 81/2018 declaration obligations.

### 2.3 Extraction-failure UX — ✅ shipped
`extractionError` field on bills (`convex/schema.ts`); the extraction action catches
failures and calls `markExtractionFailed` (`convex/bills/extraction.ts`) instead of dying
silently. The review route shows a "We couldn't read this receipt" banner with **Scan
again** (re-uploads into the *same* bill via `useScanUpload.rescan`) and **Enter items
manually**. Plus: the scanner now shows a **photo preview with Use/Retake** before the
paid Gemini call, and a "Try a sample bill" demo entry (seeded Maison Zola receipt,
`createDemoBill`). Since 2026-07-06, transient vision-API failures are retried with
backoff (`@convex-dev/action-retrier`) before the failure banner ever shows.

### 2.4 Share-token expiry/revocation + bill cleanup — ✅ shipped
- `revokeShare` mutation rotates the token and drops the bill back to `READY`; surfaced
  as "Revoke this link" in the share UI (`ShareSplitCard`).
- Daily cron purges bills untouched for 60 days (`convex/crons.ts`, `by_updatedAt` index).
- Guests capped at 30 people/bill + a per-bill join rate limit.

### 2.5 Analytics + error monitoring — ⏳ next up
Nothing yet — and the venue pitch needs numbers. **Blocked on creating accounts/keys.**
- Product analytics (PostHog or Plausible): scans, extraction success rate, publishes,
  guest joins per bill, claim completion.
- Error monitoring (Sentry) on both the browser and Convex actions.

### 2.6 QR code for share links — ✅ shipped
`qrcode.react` + `ShareSplitCard` (`src/components/bill/ShareSplitCard.tsx`): QR dialog
("Show QR code") on the split screen, inline share card on the summary — which previously
had no share affordance at all. Shipped alongside: **"Share totals as text"** on the
summary (WhatsApp-ready per-person totals, `src/lib/shareText.ts`) and **OG previews on
`/join`** (merchant + bill total in the WhatsApp unfurl).

### 2.7 Optional accounts (prerequisite for venues)
Hosts are identified only by possession of `billId` in localStorage; clearing the browser
loses everything and host mutations have zero authorization.
- **Better Auth component** (`@convex-dev/better-auth`) with Google login + email magic
  link (optional for consumers, required for venues). Decided 2026-07 over Convex Auth:
  Convex Auth is still beta ("may change in backward-incompatible ways") and has no
  TanStack Start guide; Better Auth has an official Start guide, and its anonymous
  plugin maps onto the existing guest-session model if guests ever upgrade to accounts.
  Magic-link email delivery via the `@convex-dev/resend` component. See §8.
- `users` table; stamp `ownerId` (already reserved in `convex/schema.ts`) on creation;
  add ownership guards to host mutations (`saveWorking`, `publish`, `finalize`, …).
- Anonymous flow must keep working exactly as today.

### 2.8 Polish batch (fast follows, not blockers)
- **Real PWA**: manifest exists but no service worker → add `vite-plugin-pwa`
  (installability matters for venue staff phones).
- **Arabic + French i18n & RTL**: UI is hardcoded English (`src/lib/appContent.ts`);
  shadcn primitives already carry `rtl:` classes and a `DirectionProvider` —
  `__root.tsx` currently pins `lang="en"` / ltr.
- **Landing page**: `/` is the scanner; add a marketing page (what it is, 30-sec demo
  video, venue CTA) with proper SEO/OG images — the scanner moves to the hero button.
- Capture polish: retake flow, edge-crop hints, "photograph the whole receipt" guidance.
- Empty/loading states audit across routes; haptics/micro-feedback on claim taps.

---

## 3. Billy for Venues — product design

### The core loop (launch version, zero POS integration)

1. Venue staff logs into the venue account (phone with Billy installed as PWA).
2. Table asks for the bill → staff prints the check from their POS **as they already do**
   → scans it with Billy → picks the table name.
3. A **table session** opens: big QR on the staff phone / printed QR stand / small display.
4. Guests scan the QR → land on the (existing) `/join` guest page → claim their items →
   everyone sees live per-person totals in LBP and USD at the receipt's own rate.
5. Staff sees claim progress; unclaimed remainder is visible to the table (social pressure
   does the collecting).

The entire extraction → review → claim pipeline already exists; venue mode is a thin
layer of **identity + branding + session ergonomics** on top.

### Re-scan merge — the club feature (near-live tab, no POS work)

Clubs/bars run open tabs for hours. Manual double entry is a non-starter (rejected in
planning); POS APIs don't exist here (§1). Instead:

- Staff re-prints the running tab at any point (a button every POS has) and **re-scans it
  into the same session**.
- Billy diffs the new extraction against the current bill: match lines on
  normalized-name + unit price, **add** new quantities/items, **never delete or shrink**
  lines that already have claims; flag ambiguous matches for a quick staff confirm.
- Guests' existing claims are untouched; new items appear live (Convex push — free).
- End of night: final print → final scan → finalize.

This is a genuinely new mechanism for the category — qlub/Sunday need the POS feed; Billy
needs the printer the venue already has.

### Data model & code shape

The one-document-per-bill design makes this cheap:

- New `venues` table in `convex/schema.ts`: name, slug, logo, contact, subscription
  status (`pilot | active | suspended`), staff auth (auth user ids, or a venue PIN for
  shared staff phones), default table names.
- `bills.venueId: v.optional(v.id('venues'))` + `.index('by_venue', ['venueId'])` —
  optional field, no migration; consumer bills simply have no venue.
- Merge logic is a pure transform → `src/lib/bill/merge.ts` (same pattern as
  `src/lib/bill/edits.ts`); applied via a new mutation that re-runs the reconcile checksum.
- Venue dashboard route (`/venue`): open sessions, recent bills, per-night totals,
  "new table session" as the single big action.
- Guest page gains venue branding (logo, name) when `venueId` is set; consumer bills show
  "powered by Billy — split your own bill" instead. Tip line toggle per venue.

### Integration roadmap

| Phase | Integration | Effort/route |
|---|---|---|
| B (launch) | **None — scan + re-scan merge** | already designed above |
| C | **Foodics API** (pay-at-table guide, OAuth partner program, marketplace listing) | self-serve; gets Gulf-style venues + credibility |
| C/D | **Omega / BIM partnerships** | BD conversation armed with live venue traction |
| deferred | Printer interception (ESC/POS tap) | researched, parked — re-scan covers the need |

---

## 4. Pricing & monetization (Lebanon-realistic)

- **Consumer: free forever.** It is the acquisition channel; charging kills virality.
  (If ever monetized: cheap one-time unlock for power features, per the spec — never a
  consumer subscription.)
- **Venues:**
  - **Pilot phase: free for the first 5–10 venues** in exchange for feedback, a testimonial,
    and the QR stands on tables. Learn, then price.
  - Then simple flat tiers in USD, **collected manually** — cash, Whish, OMT, or bank
    transfer; accounts activated by hand. No payment-rail engineering until it hurts.
    Starting hypothesis: **~$25–50/mo per venue** (≈ one table's service charge), custom
    for groups/chains, discount for annual prepay. Validate against pilot willingness-to-pay.
  - Card billing (Areeba or a foreign entity + Stripe) only at real scale.
- **Stay a calculator.** No money movement → no BDL/AML fintech licensing. Settlement /
  payments is a Phase-D question with real legal homework, not a feature toggle.
- Gemini cost per scan is fractions of a cent — COGS is not the constraint; abuse is (§2.1).
  - Verified 2026-07-06: the `gemini-3.5-flash` default was ~1¢/scan ($1.50/$9.00 per M
    tokens); switched to **`gemini-2.5-flash-lite`** ($0.10/$0.40) — ~18x cheaper, ~$0.0005
    per scan. Step up to `gemini-3.1-flash-lite` ($0.25/$1.50) if checksum pass-rate drops.
    AI Gateway itself is free (its dashboard "cost" is a pass-through estimate of Google's
    bill, undercounted because it can't see image tokens). For the Phase-C second-provider
    fallback, Workers AI's free 10k neurons/day (~200 scans/day via
    `llama-3.2-11b-vision` / `llama-4-scout`) routes through the same gateway.

---

## 5. Marketing plan (Lebanon)

### Venue sales motion (the priority)

- **Hit-list of ~20 venues**: Mar Mikhael / Gemmayze / Badaro bars, Batroun & Jounieh
  beach clubs — it is July, **peak season is now**; a beach-club pilot in August is worth
  ten meetings in November.
- **The demo IS the pitch**: walk in, scan their own receipt, splits on the table's phones
  in under 60 seconds. Bring printed QR table stands as the leave-behind.
- Sell to their pain, not our features: end-of-night bill disputes, faster table turnover,
  staff time spent recalculating splits, "who had the 5th Chivas" arguments at clubs.
- One flagship venue with a real testimonial beats a deck. Get the first pilot free and
  loudly branded ("as seen at …" social-proof loop).

### Consumer growth (the funnel)

- **The share link is the product's marketing.** Every published bill exposes new people;
  instrument guest→host conversion (§2.5) and put a "split your own bill" CTA on the
  guest page.
- **WhatsApp-first**: make the shared link preview beautiful (OG image with merchant +
  total) — bills are shared in WhatsApp groups, that preview is the ad.
- **Instagram/TikTok reels**: receipt → items → split → totals in 30 seconds; partner
  with Lebanese food bloggers/reviewers for "how we split at [restaurant]" content.
- **Universities** (AUB/LAU/USJ/BAU): student groups split constantly and are
  price-sensitive in exactly the dual-currency way Billy solves.
- **Diaspora/summer visitors**: USD earners visiting in summer — clean USD totals is
  their feature; time the push to the expat season (now).

### PR & credibility

- Local tech/startup press and communities; Product Hunt once the landing page exists.
- The story writes itself: "Lebanese dual-currency chaos, solved at the table."

### Metrics that back the pitch deck

Bills/week, average guests per bill, guest→new-host conversion, extraction success rate,
venue sessions/night, claim completion rate, venue retention month-over-month.

---

## 6. Pitch checklist (venues & investors)

- [ ] Landing page with 30-sec demo video
- [ ] One-pager PDF (AR/EN/FR) for venue owners: loop diagram, pricing, WhatsApp contact
- [ ] Demo kit: laminated sample receipt + QR stand + a phone with the PWA installed
- [ ] Live metrics dashboard (even a simple one) to show real usage
- [ ] Testimonial + photos from first pilot venue

---

## 7. Phased execution

### Phase A — consumer launch hardening (§2.1–2.6)
- [x] Rate limiting + spend kill switch on extraction pipeline (`@convex-dev/rate-limiter`; per-device buckets + global daily budget; `EXTRACTION_DISABLED` env kill switch)
- [x] `/privacy` + `/terms` routes, linked from footer and guest page (contact email is a placeholder — set the real one)
- [x] Extraction-failure state + retake / manual-entry UX (`extractionError` on the bill; review banner re-scans into the same bill)
- [x] Share-token revoke (`revokeShare` rotates the token), guest cap (30 people + join rate limit), bill TTL cleanup cron (60 days inactive)
- [ ] Analytics (PostHog/Plausible) + Sentry — needs accounts/keys
- [x] QR code on split (dialog) + summary (inline share card)
- [ ] Landing page — OG/WhatsApp unfurl on `/join` is done; the marketing page itself remains
- [x] Photo preview/retake confirm before extraction — IDEAS §2
- [x] WhatsApp text summary export from summary screen — IDEAS §3
- [x] Demo bill: seeded Maison Zola receipt, zero extraction cost ("Try a sample bill" on the scanner) — IDEAS §6
- [x] Extraction retries on transient vision failures (`@convex-dev/action-retrier`, §8)
- **Exit criteria:** app is safe to post publicly; funnel metrics flowing.

### Phase B — venue MVP + pilots (§2.7, §3)
- [ ] Auth via `@convex-dev/better-auth` + `@convex-dev/resend` (optional consumer, required venue) + ownership guards on host mutations (§2.7, §8)
- [ ] `venues` table + `bills.venueId` + `by_venue` index
- [ ] Venue dashboard route + "new table session" flow + table naming
- [ ] Re-scan merge (`src/lib/bill/merge.ts` + mutation + staff confirm UI)
- [ ] Venue branding on guest page; "powered by Billy" CTA on consumer bills
- [x] Mark-as-paid per person: `paidAt` on the person validator, host + session-scoped guest mutations, "Paid ✓" toggles on the final receipt (host summary + guest join) and ✅ in the WhatsApp text — IDEAS §1, deliberately trimmed 2026-07-06: payment note / settle progress / cash view were cut as unnecessary
- [ ] Tip line (separate from service charge) + venue presets — IDEAS §4
- [ ] Multi-photo scan for long club tabs — IDEAS §2
- [ ] Static per-table QRs (`/t/{venue}/{table}` → current open session) — IDEAS §5
- [ ] "Split leftovers evenly" on finalize — IDEAS §4
- [ ] PWA (service worker/installability) for staff phones
- [ ] Printed QR stand template + one-pager (§6)
- [ ] **Sign 5–10 free pilot venues (beach clubs first — it's summer)**
- **Exit criteria:** one venue using Billy nightly for 2+ weeks without hand-holding.

### Phase C — monetize & scale
- [ ] Turn on pricing (manual collection: cash/Whish/OMT/transfer), pilot → paid conversion
- [ ] Arabic + French i18n, RTL enabled
- [ ] Foodics API integration + marketplace listing
- [ ] Omega / BIM partnership outreach (armed with traction)
- [ ] Per-venue reporting → venue analytics dashboard (per-night report v1) — IDEAS §5
- [ ] Venue menu priors in the extraction prompt (accuracy moat) — IDEAS §2
- [ ] Night recap shareable card (club virality) — IDEAS §3
- [ ] Second-provider extraction fallback + offline capture queue — IDEAS §2
- [ ] Multi-branch support
- **Exit criteria:** ≥10 paying venues, retention holding.

### Phase D — only with traction
- [ ] Card billing rails (Areeba / foreign entity)
- [ ] Settlement/payments exploration **with licensing homework** (BDL/AML)
- [ ] Native host app if on-device OCR / offline-at-the-table becomes a must

---

## 8. Platform choices — Convex components & integrations

Decided 2026-07-06 against the [Convex components catalog](https://www.convex.dev/components).
Components are open-source packages mounted in `convex/convex.config.ts`; they have no
separate price — they bill as ordinary function calls / DB I/O on our deployment.

### Chosen (by phase)

| Need (roadmap ref) | Choice | Phase | Status |
|---|---|---|---|
| Abuse control on the paid extraction path (§2.1) | `@convex-dev/rate-limiter` | A | ✅ shipped |
| Retry transient vision-API failures before surfacing an error (§2.3, IDEAS §2) | `@convex-dev/action-retrier` | A | ✅ shipped 2026-07-06 |
| Product analytics (§2.5) | `posthog-js` (browser) + `@posthog/convex` component (backend events: extraction success rate) | A | ⏳ blocked on account/keys |
| Error monitoring (§2.5) | `@sentry/react` (browser) + Convex dashboard → Sentry exception reporting for functions | A | ⏳ blocked on keys |
| Accounts: consumer optional, venue required (§2.7) | `@convex-dev/better-auth` — over Convex Auth: that's still beta with no TanStack Start guide; Better Auth has an official Start guide and an anonymous plugin matching our guest sessions | B | decided |
| Magic-link / OTP email delivery for auth (§2.7) | `@convex-dev/resend` | B | with auth |
| PWA installability for staff phones (§2.8) | `vite-plugin-pwa` (npm plugin, not a component) | B | |
| Venue per-night reports at scale (IDEAS §5) | `@convex-dev/aggregate` — v1 can be plain `by_venue` indexed queries; adopt aggregate when counts/sums over many bills get hot | C | |
| Per-venue closing-time auto-finalize (IDEAS §5) | `@convex-dev/crons` (runtime-registered crons; static `convex/crons.ts` covers today's fixed TTL purge) | C | |
| First non-additive schema change | `@convex-dev/migrations` — venue fields are additive so nothing needed yet; adopt at the first widen-migrate-narrow | as needed | |
| Arabic/French i18n (§2.8, Phase C) | library TBD (Paraglide vs react-i18next) — decide when scheduled | C | |

### Considered and rejected (so we stop re-litigating)

- **Payments components (Stripe/Polar/…)** — §4 says manual collection (cash/Whish/OMT)
  until real scale; no payment-rail engineering.
- **WhatsApp Cloud API component** — sharing is client-side `wa.me` links + OG previews;
  business-API messaging is a different product with Meta approval overhead.
- **Workpool / workflow** — extraction is a single action; the rate limiter's global
  daily budget already caps throughput. Revisit only if multi-step venue pipelines appear.
- **Action cache / LLM cache** — every receipt image is unique; nothing to cache.
- **`@convex-dev/r2`** — `convex/lib/imageStore.ts` is already the storage seam; images
  are deleted right after extraction, so Convex storage costs stay ~zero. Swap only if
  that changes.
- **Presence** — "who's on the split" is polish; Convex push already makes claims live.
  Maybe a venue staff-view nicety in C/D.
