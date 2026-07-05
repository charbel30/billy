# Billy — Product Ideas & Pitch Ammunition (code walkthrough, 2026-07)

Companion to [`ROADMAP.md`](./ROADMAP.md). The roadmap is the execution plan; this doc goes
further — a deep pass through the actual code looking for gaps, upgrades, and angles that
make the product genuinely better and the business pitch land. Each idea notes **why it
matters** and **where it touches the code**. The best of these are folded into the
roadmap's phase checklists.

---

## 1. The missing layer: settle-up (biggest product gap found)

Walking the full flow, the app ends at exactly the wrong moment. `BillSummary`
(`src/components/bill/BillSummary.tsx`) shows beautiful per-person totals… and then
nothing. Finalize makes the bill read-only ("This split is finalized, so the receipt is
read-only") — a dead end at the peak-intent moment: **people are holding their phones,
knowing what they owe, about to hand over money.**

Still a calculator (no money movement, no licensing) — but close the loop:

- **"Mark as paid" per person.** A `paidAt: v.optional(v.number())` on the `person`
  validator (`convex/schema.ts`); guests mark themselves via their session, host can mark
  anyone. Live checkmarks on every phone — social pressure does the collecting.
- **Settle progress** on summary: "3 of 6 settled · 4,200,000 LL still out."
- **Host payment note:** free-text "how to pay me" (cash / Whish number / OMT) shown on
  each guest's little receipt. Zero rails, pure text, kills the "wait, how do I pay you?"
  round-trip.
- **Cash-friendly rounding display:** totals round to 1 LL (`roundToTarget` in
  `src/lib/split.ts` — mathematically exact, keep it), but nobody hands over 1,847,332 LL.
  Show an optional "cash view": nearest 50k/100k note with the drift shown ("≈ 1,850k LL,
  +2.7k"). Display-only, never stored.
- **For venues this is the feature:** the staff sees which seats have settled without
  hovering over the table. That's the table-turnover pitch made visible.

## 2. Capture & extraction upgrades

Found in `src/components/scan/ScannerHub.tsx` + `convex/extraction/*`:

- **No preview/retake before upload.** `handleFile` goes straight from camera to
  compression to a paid Gemini call. Add a one-tap confirm screen (photo + "readable?
  whole receipt in frame?") — cuts wasted extractions and bad reviews. Cheap, high value.
- **Long receipts = multi-photo.** One photo only today; a club tab at 3am doesn't fit in
  one frame. Accept 2–3 photos, send all parts in one Gemini call (multi-image input is
  native to vision models; the seam in `convex/extraction/vision.ts` already isolates the
  provider call). This is a **venue-mode prerequisite**, not a nice-to-have.
- **Second-provider fallback.** `callVisionModel` is already a swappable seam — on failure
  or checksum mismatch, retry once with a second model before surfacing an error.
  Extraction reliability is the whole first impression.
- **Offline capture queue.** Lebanese internet reality: let the photo be taken and queued
  offline (`useOfflineIndicator` already exists), upload when back. Pairs with the PWA
  work in the roadmap.
- **Venue menu priors (moat, Phase C).** For venue accounts, keep a per-venue dictionary
  of item names learned from past scans and inject it into the prompt
  (`convex/extraction/prompt.ts`): "this venue's menu includes …". Extraction gets more
  accurate every night they use it — the product literally improves with tenure, which is
  a retention argument in the pitch.

## 3. Sharing & viral mechanics (the WhatsApp layer)

The share link exists, but the surrounding growth loop has holes:

- **WhatsApp text summary — one tap.** The single most Lebanese feature possible.
  From summary, copy a formatted message:
  `Billy 🧾 Ferdinand — Sara: $23 / 2,070k LL · Karim: $18 / 1,620k LL · … pay Rami (Whish 03 …)`.
  All the data is already in `computePortfolios`; it's a formatting function + clipboard.
  Every paste into a group chat is an ad.
- **OG/link preview on `/join`.** The link lands in group chats; today it unfurls as
  nothing. Server-render OG tags: merchant name, total, "claim your items". (Roadmap §2
  has OG images — this pins the *join route specifically* as the one that matters.)
- **Summary route has no share affordance.** `src/routes/summary/$billId.tsx` only offers
  "Back to split" — the host on the summary screen can't re-copy the link or show the QR.
  Add share + QR right there.
- **Night recap card (clubs, Phase C).** On finalize, generate a shareable image —
  total damage, top item, biggest spender, hours open. Spotify-Wrapped-for-your-table.
  People post it; the venue's name is on it; that's the venue's marketing *and* ours.
- **Guest → host conversion moment.** After a guest marks themselves paid, that's the
  exact moment to show "Split your own bill next time — it's free." Today the guest page
  never pitches back.

## 4. Fairness & split-completeness ideas

From `src/lib/split.ts` + the claim UX:

- **"Split leftovers evenly" at finalize.** `totalRemainingLbp` already computes the
  unclaimed remainder; when the host finalizes with leftovers, offer one tap to distribute
  them across everyone (or to a chosen person). Kills the most common end-of-night stall.
- **Tip line, separate from service charge.** Schema has `serviceCharge` + `tax` only.
  Lebanese receipts print service; an *extra* tip is its own thing — and "digital tips go
  up" is literally qlub/Sunday's headline venue pitch. Add `tip` + `tipSplitMode`
  alongside the existing service plumbing; venue accounts get suggested-tip presets.
- **Item emoji / auto-categorization.** Cosmetic but demo-magic: 🍺 next to Almaza, 🍔 next
  to Mini Burger. A tiny name→emoji map, zero model calls. Makes screenshots and reels pop.
- **"Edited elsewhere" surfacing.** `bills.version` exists precisely to detect concurrent
  edits (`convex/schema.ts` comment) but nothing shows it. A quiet "bill was updated"
  toast on the host screens prevents last-write-wins surprises when co-hosting from two
  phones.

## 5. Venue-specific ideas (beyond the roadmap's §3)

- **Static table QRs.** Venues shouldn't reprint QRs per bill. Give each venue permanent
  per-table codes (`/t/{venueSlug}/{table}`) that resolve to that table's *current open
  session*. Laminated stand printed once, works forever. (Data model: `tableName` on the
  bill + a tiny resolver query — trivial with `by_venue` index.)
- **Venue analytics dashboard = half the subscription value.** We see something the POS
  doesn't: *who* consumed *what*, party sizes, claim speed, settle speed. Per-night
  report: sessions, average party, most-claimed items, average settle time, tips. This
  turns Billy from "a splitting tool" into "table intelligence" — and it's a dashboard
  over data we already store.
- **Per-venue defaults:** default rate (the `rate: null → $0.00` amber path in
  `BillSummary.tsx:53` should never hit a venue guest), service-charge preset,
  currency-first preference (some venues are LBP-first — headline currency is hardcoded
  USD today), suggested tips.
- **Staff mode ergonomics:** PIN unlock on a shared phone, "new session" as the only big
  button, auto-finalize sessions at closing time (cron exists to be written anyway).
- **Dispute log:** finalized bills with claim history are a record of "who ordered what,
  who paid" — venues settle end-of-night register disputes with it. Free feature, strong
  pitch line for clubs.

## 6. Pitch ammunition (things that make the demo land)

- **Demo bill — zero-cost, always works.** Seed the Maison Zola receipt from the spec
  (appendix A) as a reproducible demo: a "Try a sample bill" button on the landing page
  and in every pitch. No camera, no Gemini call, no network luck in a dark club. Also
  what investors will click first. (Implementation: a mutation that clones a canned
  `WorkingBill`; no extraction involved.)
- **The 60-second script:** scan *their* receipt → hand them the QR → their own staff
  claims drinks on their own phones → point at the live totals in LL and USD *at their
  own rate*. The dual-currency rate derivation (`deriveRate`) is the moment Lebanese
  venue owners visibly get it — lead with it.
- **ROI one-liner for venues:** (minutes saved settling per table) × (tables/night) ×
  (staff cost + extra covers from faster turnover). Even conservative numbers dwarf
  $25–50/mo. Put the formula in the one-pager; fill it in live per venue.
- **Objection prep:**
  - *"My POS already splits."* — It splits *payments* into N equal parts at the register;
    it doesn't let 8 phones claim their own items from their seats. Different job.
  - *"What if the scan is wrong?"* — Checksum against the printed total + review screen;
    the venue's printout stays the source of truth (`src/lib/reconcile.ts`).
  - *"Internet dies at midnight."* — Guests only need one page-load; claims are tiny
    WebSocket messages; offline capture queue is coming (§2).
  - *"Is my data safe?"* — Receipt image is deleted right after extraction
    (`convex/extraction/actions.ts`); no card data ever; privacy page in Phase A.
- **Founding-venue program:** first 10 venues get lifetime discount + logo on landing
  page + input on the venue dashboard. Scarcity + flattery, costs nothing.
- **Venue referral:** a free month per referred venue. Owners in Mar Mikhael all know
  each other; make the network work for us.

## 7. Small polish (fast, compounding)

- Photo-tips microcopy on first scan ("flatten the receipt, get the total in frame").
- Skeletons/optimistic feel on guest claim taps (`saveGuestClaims` round-trips today;
  a pending visual state on the stepper hides the latency).
- Haptics (`navigator.vibrate`) on claim steps and settle — cheap delight on Android.
- The "not open yet" guest dead-end (`join/$shareToken.tsx:143`): the query is already
  live, so add "this page will update by itself when the host opens the split" — it's
  true, say it.
- Person avatars: initials + existing person colors are fine; add emoji picker later.
- `datetime` is extracted but never shown — display it on the summary/recap ("Friday,
  01:12 AM" is great flavor on a club recap card).
- History rail (`RecentScanPanel`) shows "Untitled bill" for unnamed scans — backfill
  the merchant name after extraction (data exists, history entry just isn't updated).

## 8. Where each idea lands (roadmap phase mapping)

| Idea | Phase | Why there |
|---|---|---|
| Photo preview/retake before extraction | **A** | cuts Gemini waste + bad first impressions |
| WhatsApp text summary + summary-screen share/QR | **A** | the viral loop, near-zero effort |
| Demo bill (sample receipt) | **A** | landing page + every pitch depends on it |
| OG preview on `/join` | **A** | part of landing/OG work already planned |
| Settle-up layer (mark paid, payment note, progress) | **B** | completes the loop; the venue demo needs it |
| Tip line + venue presets | **B** | the qlub-style venue pitch number |
| Multi-photo long receipts | **B** | club tabs won't fit one frame |
| Static table QRs + table names | **B** | venue ergonomics, prints once |
| Split-leftovers-evenly at finalize | **B** | end-of-night stall killer |
| Venue analytics dashboard (v1: per-night report) | **C** | subscription-value deepener |
| Venue menu priors in extraction prompt | **C** | accuracy moat, retention story |
| Night recap shareable card | **C** | viral flywheel once volume exists |
| Second-provider extraction fallback, offline queue | **C** | reliability hardening |
| Emoji categorization, avatars, haptics, cash view | polish | sprinkle into any phase |
