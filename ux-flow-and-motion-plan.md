# UX flow & motion plan

Status: **decided, not started**. Agreed 2026-09-11 in a design-tree session; every
section below is a settled decision unless it is explicitly marked *open* or *backlog*.
This is the implementation plan for the "one continuous surface" rework of the bill flow
(scan → review → split → summary). It is written so that a phase can be picked up cold —
by a person or an agent — and shipped as one PR.

Read with `CLAUDE.md` (directory contract, where code goes) and
`.claude/skills/make-interfaces-feel-better/SKILL.md` (motion values, hit areas, concentric
radii). Nothing here overrides the directory contract; where this plan names a file path it
is applying that contract, not inventing a new one.

Contents

1. Problems this fixes (observed, with file refs)
2. Decisions (the settled design tree)
3. Shared foundations (tokens, motion, view-transition names, the dock shell)
4. Phase A — Shared shell: dock + header everywhere, review/summary brought to the split's language
5. Phase B — Processing takeover: the scan wait becomes a full-screen state owned by review
6. Phase C — Route transitions + step gating
7. Phase D — Summary redesign: from read-only echo to settlement screen
8. Phase E — Desktop parity (last)
9. Appendix: backlog, risks, QA checklist, facts this plan relies on

---

## 1. Problems this fixes

Mobile is the product. Everything below was observed on the mobile layouts unless noted.

### 1.1 The scan wait shows an empty editor

- `src/components/features/scan/ScanReceiptActions.tsx` `confirmPhoto()` runs the whole
  pipeline (`createBill → compress → upload → attachImageAndExtract`) behind a spinner in the
  "Looking good?" dialog, then navigates to `/review/$billId`. Extraction is still running.
- `ReviewPage` renders the **full, interactive, empty editor** with an `ExtractingBanner`
  on top (`ReviewPage.tsx:144`). "Reading your receipt" sits above an "Add the first item"
  empty state. It reads as broken.
- **It is also a data bug.** `convex/bills/extraction.ts` `applyExtraction` only applies when
  `bill.version === bill.extractionBaseVersion` (`canApplyExtraction`). Any edit the user makes
  while waiting is flushed by `useBillEditor`'s debounced `saveWorking`, which bumps `version`,
  and the extraction result is then **silently discarded** (`clearExtraction`). Letting people
  type into the editor during extraction guarantees lost scans.
- If the user refreshes mid-upload, the bill exists with no image, no items and no error; the
  review page shows the manual-entry empty state with no hint that a photo was lost.

### 1.2 Four different bottom surfaces

| Screen | Component | Shape |
| --- | --- | --- |
| split, join | `bill/workspace/MobileSplitSheet.tsx` (base-ui `Drawer`, 313 lines) | floating, inset 16px, `rounded-[1.5rem] bg-muted shadow-dock`, drag handle, two snap points, compact⇄overview crossfade driven by `--sheet-progress` |
| review | `review/components/MobileReviewAction.tsx` | `sticky bottom-0`, gradient fade, `rounded-card bg-muted/95 backdrop-blur-xl ring-1` |
| summary | none | three stacked full-width buttons in the page flow |
| split, join (people) | `bill/people/AddPerson.tsx`, `MobilePersonPicker.tsx` | base-ui `Dialog` pushed to the bottom edge with `max-sm:bottom-0 max-sm:rounded-b-none …` — edge-to-edge and square-bottomed, sitting over a floating rounded dock |

Different radius (`1.25rem` vs `1.5rem`), different blur, different backgrounds, different
shadow, different CTA heights (`h-[3.25rem]` vs `min-h-12` vs `size-lg`).

### 1.3 Three different headers

- split/join: `bill/workspace/WorkspaceHeader.tsx` — icon tile, merchant name, status badge,
  "Link live" pill, rate chip that cycles the currency display (`useCurrencyDisplay`).
- review: its own layout — `BlurCommitInput` merchant name at `text-3xl/4xl`, caption row,
  `RateField` + `SaveStatus` row. No status badge, no currency display toggle.
- summary: `BillSummary`'s own `h2` title. No header at all.

### 1.4 Mobile review cannot toggle service & tax

`CompactServiceTaxControl` is rendered only inside `SettlementSummary`, which is
`hidden lg:block` (`SettlementSummary.tsx:27`). On phones there is no way to turn the service
charge on/off or edit it.

### 1.5 No transitions between steps

No `viewTransition`, no `startViewTransition`, no `AnimatePresence` around the outlet. Routes
use `pendingComponent: <Loader />` and have **no loaders**, so a direct load flashes the
loader; navigating review→split just swaps the page. `lib/ui/animations.ts` has `fadeRise`,
`staggerChild`, `softExit`, `sheetSpring` presets, none used at page level.

### 1.6 Summary "feels useless"

`SummaryPage.tsx` is an info alert ("This is a live preview…"), `BillSummary`, and three
buttons (share text, QR, back to split). It duplicates the split's expanded "Table totals"
sheet and has no job of its own.

### 1.7 Smaller drift

- Step nav (`shared/AppHeader.tsx` dropdown) lets you open Split/Summary for a `PENDING`,
  empty or still-extracting bill; nothing is gated.
- `scan/components/RecentBills.tsx` resumes by the **stored** step (`billy:bill-history`),
  not by bill status — a bill recorded at `split` reopens there after being finalized.
- Inline copy in `SplitPage.tsx` / `SummaryPage.tsx` (descriptions, notices) violates the
  `content.ts` rule; `split/` and `summary/` have no `content.ts`.
- `ReadOnlyNotice` is placed differently on every screen.
- `tapHaptic()` is only wired on the review CTA.
- The `table-totals-drawer.css` `data-position-ready=false → visibility:hidden` trick hides
  the dock for a frame after mount; harmless today, fatal for view-transition snapshots.

---

## 2. Decisions

The design tree, collapsed. Each line is a decision that was put to the owner and answered.

**Document**
- Lives at repo root as this file, implementation-ready, listed in `CLAUDE.md`.

**Motion technology**
- Route transitions use the **CSS View Transitions API** through TanStack Router's
  `defaultViewTransition` with **typed** transitions. Fallback is a hard cut (no polyfill).
  Old in-app browsers (WhatsApp/Instagram webviews) may get hard cuts; accepted.
- In-page choreography (staggers, swaps, shared-layout morphs) stays on `motion`.
- Reduced motion (`prefers-reduced-motion`) → view transitions become a plain crossfade,
  motion presets already respect `MotionConfig reducedMotion="user"`.

**Processing wait**
- **Review owns it.** The scan pipeline is hoisted out of `ScanReceiptActions` into a
  cross-feature scan-job store. Navigation to `/review/$billId` happens as soon as
  `createBill` returns; review renders a full-screen `ProcessingScreen` for upload +
  extraction and then reveals the editor.
- The processing screen shows the **user's actual photo** (local object URL) with the scan
  beam and staged labels: *Uploading → Reading the receipt → Checking totals*.
- **Editing is blocked** during processing (no editor rendered). After
  `PROCESSING_SLOW_HINT_MS` (10s) an escape hatch appears: "Taking long? Enter items manually",
  which calls a new host mutation `abandonExtraction` and drops into the empty editor.
- Landing → review is a `takeover` transition where the confirmation dialog's preview image is
  the shared element that grows into the processing screen.
- Processing → editor reveal: the photo shrinks into a **session-only "Compare with photo"
  thumbnail** in the review header area (motion `layoutId`), line items stagger in, totals
  count up, the dock rises last. `NEEDS_REVIEW` bills pulse their flagged rows once.
  The thumbnail is the local object URL only (the server deletes the image after extraction),
  disappears on refresh, and carries a one-line disclosure.

**Dock**
- **Every bill screen** (review, split, join, summary) has the same floating dock shell on
  mobile, with per-screen content. Modal bottom sheets (add person, person picker) use the
  same shell in modal mode.
- **Per-page instance + `view-transition-name: dock`** (not a root-level persistent host).
  The shell must paint its collapsed position on first commit (no measure-then-hide) so the
  browser can snapshot it. *Escape valve*: if per-page morphing is not continuous enough, a
  root-level context-shared `DockHost` replaces the instance without page-code changes — the
  content contract below is designed for that.
- **Split is the visual reference.** Its floating shell, `WorkspaceHeader`, and card surfaces
  become the shared language. Review's editorial merchant-name input is replaced by
  tap-to-edit inside `WorkspaceHeader`; the rate chip opens the rate editor.
- Currency display toggle (both / USD / LBP) is available on review and summary via the shared
  header.
- Review dock: collapsed = Total (USD + LBP) + "Proceed to split"; expanded panel = service &
  tax control, rate editor, printed-total check, save status — the same content as the desktop
  `SettlementSummary` aside.

**Transitions**
- Persist + slide: `AppHeader` and the dock carry fixed names and morph; `<main>` slides
  horizontally in step direction (forward = enters from the right, back = enters from the
  left) with a short fade. The bill total shares a name across review dock → `SplitHero` →
  summary grand total so the number travels.
- Types: `step-forward`, `step-back` (derived from the `STEPS` order; browser back included),
  `takeover` (landing → review), `crossfade` (everything else).

**Gating**
- Review: always available (read-only if finalized). Split: disabled while extracting or while
  `lineItems` is empty, with the reason in the menu item. Summary: **disabled until
  `FINALIZED`** ("Finalize to unlock"); finalizing navigates into it with `step-forward`.
- `RecentBills` resumes by **status** (`FINALIZED` → summary, `READY`/`PUBLISHED` → split,
  else review), not by stored step.

**Summary**
- Post-finalize destination only. Its job is **settling**: progress header ("3 of 5 settled ·
  $42 outstanding"), unpaid first, paid toggles, **per-person Send** (that person's itemized
  message via `navigator.share`), guests see the same finalized summary on `/join`.
- Follow-up phase: host "Pay me via" note (schema field) appended to messages.
- Backlog: export the receipt as an image.

**Order**: A (shell) → B (processing) → C (transitions + gating) → D (summary) → E (desktop).
Desktop only needs to consume the same content contract; it is explicitly last.

---

## 3. Shared foundations

Land these in Phase A; later phases only consume them.

### 3.1 Tokens (`src/styles/app.css`)

Add to the `:root` block and `@theme inline`:

```css
--radius-dock: 1.5rem;          /* the floating dock / modal sheet corner */
--dock-inset: 1rem;             /* horizontal + bottom inset of the floating dock */
--dock-max-width: 28rem;        /* max-w-md */
```

Add Tailwind v4 utilities so surfaces are named, not re-typed:

```css
@utility surface-card  { @apply rounded-card bg-card shadow-card ring-1 ring-border/50; }
@utility surface-panel { @apply rounded-card bg-muted/60 ring-1 ring-border/40; }
@utility surface-inset { @apply rounded-control bg-background/70; }
@utility surface-dock  { border-radius: var(--radius-dock); @apply bg-muted shadow-dock; }
```

Rules: `surface-card` = primary content containers (line items, receipts); `surface-panel` =
secondary/aside containers; `surface-inset` = rows inside a panel or dock; `surface-dock` = the
dock shell and modal sheets only. Concentric radii: a child inside a `surface-dock` uses
`rounded-control` (0.75rem) — never another `rounded-[…]` literal. Delete the ad-hoc
`rounded-[1.5rem]`, `bg-muted/95 backdrop-blur-xl`, `border border-border bg-card` variants as
each screen is migrated.

### 3.2 Motion (`src/lib/ui/animations.ts`, new `src/lib/ui/timing.ts`)

Existing presets stay. Add:

```ts
// animations.ts
export const revealContainer = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }
export const revealRow = staggerChild            // alias with intent: receipt rows writing themselves in
export const pulseOnce = { animate: { backgroundColor: ['transparent', 'var(--warning-subtle)', 'transparent'] }, transition: { duration: 1.2, times: [0, 0.3, 1] } }

// timing.ts (exported from src/lib/ui/index.ts)
export const PROCESSING_MIN_VISIBLE_MS = 900     // never flash the processing screen
export const PROCESSING_SLOW_HINT_MS = 10_000    // show the "enter manually" escape hatch
export const ROUTE_TRANSITION_MS = 320
export const ROUTE_TRANSITION_EXIT_MS = 220
```

### 3.3 View-transition names (`src/styles/app.css`, new `src/lib/ui/viewTransitions.ts`)

Exactly one element per name may be in the DOM at a time. Owners:

| Name | Owner element | Set by |
| --- | --- | --- |
| `app-header` | `<header>` in `shared/AppHeader.tsx` | always |
| `page` | `<main>` in `routes/__root.tsx` `AppLayout` | always |
| `dock` | the dock popup (`ui/dock.tsx`) | when a `Dock` is mounted (portaled; still snapshotted) |
| `bill-total` | the *visible* headline total on the current screen | review: dock collapsed total; split: `SplitHero` total; summary: `SettlementHeader` outstanding/grand total |
| `receipt-photo` | landing confirm-dialog `<img>` while confirming; `ProcessingScreen` photo | Phase B |

`viewTransitions.ts` is pure:

```ts
export type TransitionType = 'step-forward' | 'step-back' | 'takeover' | 'crossfade'
export const STEP_ORDER = ['review', 'split', 'summary'] as const
export function stepOf(pathname: string): (typeof STEP_ORDER)[number] | null
export function transitionTypes(from: string | undefined, to: string): TransitionType[]
// '/' → '/review/*'                  → ['takeover']
// step(from) < step(to)              → ['step-forward']
// step(from) > step(to)              → ['step-back']
// otherwise                          → ['crossfade']
```

CSS lives in `app.css` under a `/* view transitions */` block (see Phase C for the keyframes).

### 3.4 The dock shell (`src/components/ui/dock.tsx`, `src/components/ui/dock.css`, `src/components/ui/bottom-sheet.tsx`)

Generic (zero bill knowledge), shadcn-style kebab-case files in `components/ui/`. Built on
`@base-ui/react/drawer` (already the dependency behind `MobileSplitSheet`). The current
`table-totals-drawer.css` moves here and its class names generalize to `dock-*`.

```tsx
// ui/dock.tsx — persistent, always-open, two states
export function Dock(props: {
  /** Collapsed content: one or two rows. Always visible when collapsed. */
  collapsed: ReactNode
  /** Expanded panel. Omit for a dock that never expands (summary). */
  panel?: ReactNode
  /** Header row of the expanded panel (title + description). */
  panelTitle?: string
  panelDescription?: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** Handle row label + trailing status. Omit `handle` when `panel` is omitted. */
  handle?: { label: string; status?: string; ariaLabel: string }
  /** Declared collapsed height in px for the first paint (refined by ResizeObserver). */
  collapsedHeightHint: number
  /** Reports measured collapsed height (+ inset) so the page can pad content past it. */
  onCollapsedHeightChange?: (px: number) => void
  /** Lift the collapsed dock above the software keyboard while an inline input is focused. */
  keyboardAware?: boolean
  /** Only render on viewports below lg; default true. Desktop renders content in an aside instead. */
  mobileOnly?: boolean
}) 

// ui/bottom-sheet.tsx — modal, opened on demand, one snap point, backdrop
export function BottomSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Bottom sheet below sm, centered dialog at sm and up (replaces the max-sm: hacks). */
  responsive?: boolean
})
```

Behavioral contract (carried over from `MobileSplitSheet`, now generic):

- Floating: `w-[calc(100%-2*var(--dock-inset))] max-w-[var(--dock-max-width)]`,
  `surface-dock`, bottom inset `max(var(--dock-inset), env(safe-area-inset-bottom))`.
- Snap points `[collapsedPx, 0.85]`, `snapToSequentialPoints`, swipe down collapses (never
  closes), tap on handle expands, collapse button in the panel header, focus management as
  today (`expandRef`/`collapseRef`).
- Compact ⇄ panel crossfade follows the real sheet position via `--sheet-progress` (keep the
  `MutationObserver` + rAF follower).
- **First paint**: the popup transform falls back to a declared offset —
  `transform: translateY(var(--drawer-snap-point-offset, var(--dock-initial-offset)))` where
  `--dock-initial-offset = calc(85dvh - <collapsedHeightHint>px)` — and the
  `data-position-ready=false → visibility:hidden` rule is **deleted**. The dock is visible and
  correctly placed in the first committed frame; the observer refines the hint afterwards.
  This is what makes the `dock` view-transition snapshot valid.
- `keyboardAware` keeps the `visualViewport` inset logic.
- `panel` content is `Drawer.Content` (scrollable), header is fixed; `expandedExtra`-style
  trailing content is just part of `panel`.
- `role`/labels: handle is a `<button>` with `ariaLabel`; collapsed region gets `inert` when
  expanded and vice versa (as today).

Dock content is **domain**, and lives with its feature or in `features/bill/` when shared.
Each content module exports two things so desktop can reuse it later (Phase E):

```ts
// convention for every dock content module
export function XxxDockCollapsed(props): ReactNode   // what sits in the collapsed row(s)
export function XxxPanel(props): ReactNode           // the expanded panel body (also the desktop aside body)
export const XXX_DOCK_COLLAPSED_HINT = <px>          // declared collapsed height
```

### 3.5 Screen layout (`src/components/features/bill/workspace/BillScreen.tsx`)

One layout component for review, split, summary (and join) so the header/notice/dock slots
and the `--dock-h` bottom padding live in one place:

```tsx
export function BillScreen(props: {
  header: ReactNode            // a <WorkspaceHeader/>
  notice?: ReactNode           // the ONE notice slot (ReadOnlyNotice, finalized lock, conflict)
  children: ReactNode          // main column
  aside?: ReactNode            // desktop-only panel (hidden lg:block); Phase E fills it
  dock?: ReactNode             // a <Dock/>; BillScreen wires onCollapsedHeightChange → padding
  width?: 'wide' | 'narrow'    // max-w-7xl grid vs max-w-md single column
})
```

`BillScreen` is what `SplitPage`, `ReviewPage`, `SummaryPage`, `JoinPage` render at the top
level; `BillSplitWorkspace` becomes content inside it rather than owning the page frame.

---

## 4. Phase A — Shared shell

**Goal.** Every bill screen uses the same header, the same dock shell, the same surfaces and
the same notice slot; review and summary look like they belong to the split. Fix the mobile
service/tax gap. Move copy into `content.ts`. No behavior changes to claims, saving, or
extraction.

### A.1 Files

New
- `src/components/ui/dock.tsx`, `src/components/ui/dock.css`, `src/components/ui/bottom-sheet.tsx`
- `src/components/features/bill/workspace/BillScreen.tsx` (+ export from `workspace/index.ts`)
- `src/components/features/bill/workspace/SplitDockCollapsed.tsx`,
  `SplitTotalsPanel.tsx` (extracted from `MobileSplitSheet`: person picker + add person +
  action slot; table-totals overview accordion)
- `src/components/features/review/components/ReviewDock.tsx` (collapsed: total + Proceed)
- `src/components/features/review/components/ReviewSettlementPanel.tsx` (service & tax, rate
  editor, printed-total check, save status) — used by the dock panel and by `SettlementSummary`
- `src/components/features/review/components/CompareRatePopover.tsx` — *not needed*; the rate
  editor is `RateField` rendered inside the panel (see A.4)
- `src/components/features/summary/components/SummaryDock.tsx`
- `src/components/features/split/content.ts`, `src/components/features/summary/content.ts`
- `src/lib/ui/timing.ts`

Modified
- `src/styles/app.css` — tokens + `@utility` surfaces (§3.1)
- `src/lib/ui/animations.ts`, `src/lib/ui/index.ts`
- `src/components/features/bill/workspace/WorkspaceHeader.tsx` — new props (A.3)
- `src/components/features/bill/workspace/BillSplitWorkspace.tsx` — renders through
  `BillScreen`, uses `Dock` + `SplitDockCollapsed`/`SplitTotalsPanel`
- `src/components/features/bill/people/AddPerson.tsx`, `MobilePersonPicker.tsx` — use
  `BottomSheet` instead of `Dialog` + `max-sm:` overrides
- `src/components/features/review/ReviewPage.tsx`, `SettlementSummary.tsx`, `RateField.tsx`
- `src/components/features/split/SplitPage.tsx`, `src/components/features/summary/SummaryPage.tsx`,
  `src/components/features/join/JoinPage.tsx`
- `src/components/shared/ReadOnlyNotice.tsx` — no visual change; just always rendered via the
  `BillScreen.notice` slot

Deleted
- `src/components/features/review/components/MobileReviewAction.tsx`
- `src/components/features/bill/workspace/MobileSplitSheet.tsx`,
  `SplitSheetHandle.tsx`, `table-totals-drawer.css` (absorbed by `ui/dock.*` and the two split
  content files)

### A.2 Dock content per screen

| Screen | Collapsed row(s) | Panel | Handle |
| --- | --- | --- | --- |
| review (host) | Total — USD headline `AnimatedAmount`, LBP compact beneath — and **Proceed to split** (`size="lg" min-h-12`) | `ReviewSettlementPanel`: `CompactServiceTaxControl`, `RateField` (inline editor, not the toggle-chip variant), "Totals don't add up" alert when `recon.diff` fails, `SaveStatus` | label "Settlement", status: `recon.ok ? 'Matches receipt' : 'Check totals'` (only when a printed total exists) |
| split / join | as today: `MobilePersonPicker` row, `MobileAddPerson` + `actionSlot` | as today: table totals overview accordion + tip control (`expandedExtra`) | label "View table totals", status "$X left" / "All assigned" |
| summary (host) | **Share totals** primary + **Show QR** secondary (icon button) | none in Phase A (Phase D adds the settlement panel) | none |
| review (read-only) / join (not joined) | no dock | — | — |

Collapsed hints (measured once during implementation and hard-coded as constants):
review ≈ 148px, split ≈ 200px (current default), summary ≈ 88px.

### A.3 `WorkspaceHeader` becomes the header everywhere

Add props, keep existing ones:

```ts
onNameCommit?: (name: string) => void   // when set, the h1 is a BlurCommitInput (tap to edit); else static text
onRateEdit?: () => void                 // when set, tapping the rate chip calls this INSTEAD of cycling display
                                         // (review: expands the dock panel / focuses the rate field)
displayToggle?: boolean                 // default true; renders the $+LL / $ / LL cycle chip
trailing?: ReactNode                    // optional slot (review: the Compare-with-photo thumbnail, Phase B)
```

Review header composition: icon tile `RiReceiptLine` (instead of `RiGroupLine`; make the icon
a prop with a default), editable merchant name, status badge (`PENDING`/`NEEDS_REVIEW`
render as "Reviewing" / "Needs a look" via `statusLabel`), rate chip. On review the currency
cycle chip stays (so `ItemPrice` respects `useCurrencyDisplay` — verify `AuditLineItems` uses
`ItemPrice` or wire it), and a separate small pencil affordance on the chip opens the rate
editor (`onRateEdit`). Summary header: `RiPieChartLine` tile, static name, `FINALIZED` badge.

### A.4 Review page restructure

`ReviewPage` renders:

```
BillScreen
  header  = WorkspaceHeader (editable name, rate chip → expands dock, display toggle)
  notice  = ReadOnlyNotice | validation alert | recovery-unavailable alert | editedElsewhere alert  (stacked in the one slot)
  children= surface-card { AuditLineItems }  ← the main column is ONLY line items now
  aside   = SettlementSummary (desktop) → renders ReviewSettlementPanel + total + Proceed
  dock    = Dock(ReviewDockCollapsed, ReviewSettlementPanel)
```

- The `RateField` row and `SaveStatus` leave the main column; they live in
  `ReviewSettlementPanel` (dock panel on mobile, aside on desktop).
- `RateField`'s collapsed "chip → editor" `AnimatePresence` stays for the desktop aside; inside
  the dock panel it renders expanded by default (`defaultOpen` prop).
- `ExtractingBanner` / `ExtractionFailedBanner` keep working in Phase A (Phase B replaces them).
- Empty state (`reviewCopy.emptyTitle`, `addFirstAction`) stays in `AuditLineItems`.

### A.5 Split / join

- `BillSplitWorkspace` renders `BillScreen`; `MobileSplitSheet` is split into
  `SplitDockCollapsed` + `SplitTotalsPanel` fed to the generic `Dock`. Behavior stays
  identical (snap points, crossfade, keyboard lift, focus).
- `AddPerson` / `MobilePersonPicker` move to `BottomSheet` (modal mode of the shell). They gain
  the dock's radius/shadow and lose the `max-sm:` overrides.
- Split notices (`ReadOnlyNotice`, finalized lock, `conflictMessage`) render in the
  `BillScreen.notice` slot rather than three different places.

### A.6 Summary (Phase A scope only)

- `BillScreen` + `WorkspaceHeader` + `SummaryDock` (Share totals / Show QR). The QR opens the
  same `ShareSplitCard` `Dialog` used by split (move that dialog into
  `features/bill/summary/ShareSplitDialog.tsx` so both pages use one component).
- Remove the "Back to split" button (the header step nav does it). Keep the live-preview alert
  until Phase C gates summary behind `FINALIZED`.

### A.7 Copy

Create `split/content.ts` and `summary/content.ts`; move every inline string from
`SplitPage.tsx` (descriptions, notices, dialog copy, conflict messages) and `SummaryPage.tsx`
(alert, titles, share toast). Add the new dock labels to `review/content.ts`
(`dock.handle`, `dock.matches`, `dock.checkTotals`).

### A.8 Acceptance criteria

- One dock implementation in the repo (`rg "Drawer.Root" src` → only `ui/dock.tsx` and
  `ui/bottom-sheet.tsx`). `MobileReviewAction`, `MobileSplitSheet`, `SplitSheetHandle`,
  `table-totals-drawer.css` are gone.
- Review, split, join, summary on a 390px viewport: same dock inset, radius, shadow and
  background; same header composition; `ReadOnlyNotice` in the same place.
- Mobile review can toggle and edit service & tax (in the dock panel).
- The dock is visible and correctly placed in the first frame after navigation (record a
  screen capture; no full-height flash, no blank frame).
- Split behavior unchanged: snap points, swipe collapse, crossfade tracking, keyboard lift.
- `rg "rounded-\[1.5rem\]|max-sm:bottom-0" src` → no results.
- No inline user-facing strings in `SplitPage.tsx` / `SummaryPage.tsx` / `ReviewPage.tsx`.
- `pnpm build` passes.

---

## 5. Phase B — Processing takeover

**Goal.** Confirming a photo leads to one continuous surface: the preview grows into a
full-screen processing view that shows the user's own receipt being read, and that view
writes itself into the editor when extraction lands. The empty editor is never shown while
a scan is in flight, which also closes the silent-discard bug.

### B.1 Files

New
- `src/lib/session/scanJob.ts` — module-level store (see B.2), exported from `~/lib/session`
- `src/hooks/useScanJob.ts` — cross-feature hook: `startScan(file)`, `rescan(billId, file)`,
  `useScanJob(billId)`
- `src/components/features/review/components/ProcessingScreen.tsx`
- `src/components/features/review/components/ProcessingFailed.tsx` (failure + photo-lost
  surface; absorbs `ExtractionFailedBanner`)
- `src/components/features/review/components/ReceiptPhotoThumb.tsx` (session-only
  "Compare with photo" + full-size viewer via `BottomSheet`)
- `src/components/features/review/hooks/useProcessingState.ts` (derives the state machine
  in B.3 from the scan job + server doc)
- `convex/bills/host/uploads.ts` → add `abandonExtraction` (B.5)
- `src/api/uploads.ts` → `useAbandonExtraction()`

Modified
- `src/components/features/scan/ScanReceiptActions.tsx` — uses `useScanJob().startScan`,
  navigates right after it resolves the bill id, sets `view-transition-name: receipt-photo` on
  the preview `<img>` while confirming
- `src/components/features/scan/hooks/useScanUpload.ts` — becomes the pipeline used *by* the
  store (compress/upload/attach), no component state
- `src/components/features/review/ReviewPage.tsx` — renders `ProcessingScreen` /
  `ProcessingFailed` / editor based on `useProcessingState`
- `src/components/features/review/content.ts` — processing copy
- `src/lib/ui/timing.ts` — `PROCESSING_*` constants

Deleted
- `src/components/features/review/components/ExtractionBanners.tsx`

### B.2 Scan-job store (`src/lib/session/scanJob.ts`)

Pure module state with `useSyncExternalStore` subscription; survives route changes because it
is not tied to a component. One job per bill id.

```ts
export type ScanStage = 'creating' | 'compressing' | 'uploading' | 'attaching' | 'extracting' | 'done' | 'failed'
export interface ScanJob {
  billId: Id<'bills'>
  stage: ScanStage
  previewUrl: string | null      // object URL of the chosen file; revoked on `clear`
  startedAt: number
  error?: string                 // scanErrorMessage() result when stage === 'failed'
}
export function getScanJob(billId): ScanJob | undefined
export function subscribeScanJobs(listener): () => void
export function setScanJob(job: ScanJob): void
export function clearScanJob(billId): void   // revokes previewUrl
// Refresh marker (sessionStorage `spolio:scan-job:<billId>` = startedAt) so a reload
// mid-upload can be told apart from a manual-entry bill. Set on start, cleared on
// done/abandon/failure-dismissed.
export function markScanStarted(billId): void
export function wasScanStarted(billId): boolean
export function clearScanMarker(billId): void
```

`useScanJob().startScan(file)`:

1. `assertHostStorageAvailable()`; `createBill` → `rememberHostToken`; `markScanStarted`;
   `setScanJob({ stage: 'creating' → 'compressing', previewUrl: URL.createObjectURL(file) })`.
2. **Resolve `billId` to the caller now.** The caller navigates.
3. Continue detached (`void (async () => …)()`): compress → `uploading` → `attaching`
   (`attachImageAndExtract`) → `extracting`. Any throw → `stage: 'failed', error`.
4. `extracting → done` is set by the review page when the server doc's `imageRef` clears
   (existing signal), not by the pipeline.

`rescan(billId, file)` is the same from step 3 with a fresh preview URL.

### B.3 Processing state machine (`useProcessingState(billId)`)

Inputs: `job = getScanJob(billId)`, `serverBill` (live), `editor.extracting`
(`Boolean(serverBill.imageRef)`), `wasScanStarted(billId)`.

```
if job?.stage in creating|compressing|uploading|attaching        → 'processing' (stage label from job)
else if serverBill.imageRef (extraction in flight)               → 'processing' (stage: 'extracting'; label flips to
                                                                    'Checking totals' after ~60% of the median run, cosmetic)
else if job?.stage === 'failed'                                  → 'failed'   (upload/attach failure, message from job.error)
else if serverBill.extractionError && !dismissed                 → 'failed'   (vision failure; existing copy)
else if wasScanStarted && lineItems.length === 0 && !imageRef
        && !extractionError && status === 'PENDING'              → 'photo-lost' (refresh mid-upload)
else                                                             → 'editor'
```

Timing rules (from `src/lib/ui/timing.ts`):
- The processing screen stays mounted at least `PROCESSING_MIN_VISIBLE_MS` after it first
  appears, even if extraction is already done (demo-speed backends, cached runs).
- After `PROCESSING_SLOW_HINT_MS` in `processing`, show the escape hatch (B.4).
- On `processing → editor`, call `clearScanMarker` and keep `job.previewUrl` alive for the
  thumbnail; `clearScanJob` runs on `ReviewPage` unmount for a different bill or on tab close.

Manual entry (`useManualBill`) and the demo bill never create a job and never set the marker,
so they land directly in `editor`.

### B.4 `ProcessingScreen`

Full-viewport surface rendered **instead of** `BillScreen` (no header content, no dock; the
`AppHeader` remains). Composition, top to bottom:

- Photo: `<motion.img layoutId="receipt-photo" style={{ viewTransitionName: 'receipt-photo' }}>`
  of `job.previewUrl`, `object-contain`, max height `min(58dvh, 34rem)`, `rounded-card`,
  dimmed to 70% with the `ReceiptScan` beam replaced by a full-width beam sweeping the photo
  (`.receipt-scan-beam` keyframes reused, scaled to the image box). If there is no local
  preview (direct load / refresh while extraction is still running) render the existing
  `ReceiptScan` illustration in the same box.
- Stage label (`role="status" aria-live="polite"`): `reviewCopy.processing.stages[stage]` —
  "Uploading your photo" / "Reading the receipt" / "Checking totals". Below it, a static
  reassurance line: the existing `scanPrivacyNote` text.
- Stage dots (three, filled progressively) — decorative, `aria-hidden`.
- Escape hatch after `PROCESSING_SLOW_HINT_MS`: `Button variant="outline"` "Taking long?
  Enter items manually" → `abandonExtraction` → state becomes `editor` (empty). Copy in
  `content.ts`.
- Cancel is *not* offered before the slow hint; the bill is already created and cheap.

Reduced motion: no beam sweep, dots only.

### B.5 `abandonExtraction` (host mutation)

`convex/bills/host/uploads.ts`, registered through `billMutation` (needs `hostToken`;
status gate: reject `PUBLISHED`/`FINALIZED` like `prepareImageExtraction`).

```
if bill.extractionRunId: try { await retrier.cancel(ctx, bill.extractionRunId) } catch {}  // throws if not executing — fine
if bill.imageRef: try { await imageStore.deleteImage(ctx, bill.imageRef) } catch (e) { console.error('[privacy] …') }
patch: imageRef undefined, extractionRunId undefined, extractionBaseVersion undefined,
       extractionError undefined, updatedAt now()          // status unchanged (stays PENDING)
returns v.null()
```

Safety already in place: `applyExtraction` returns early when `bill.imageRef !== imageRef`,
and `onExtractionComplete` resolves the bill via `by_extractionRunId`, which no longer matches.
Expose as `useAbandonExtraction()` in `src/api/uploads.ts`.

### B.6 Failure surfaces (`ProcessingFailed`)

Same full-screen frame as `ProcessingScreen`, photo dimmed to 40% with no beam. Variants:

- `failed` (upload/attach or vision): title "We couldn't read this receipt.", body from
  `ExtractionFailedBanner` today, actions **Scan again** (`rescan`, same bill) and
  **Enter items manually** (dismiss → `editor`; also `abandonExtraction` if `imageRef` is set).
  Rate-limit / kill-switch `ConvexError` messages surface verbatim (existing `scanErrorMessage`).
- `photo-lost`: title "The photo didn't finish uploading.", body "Scan it again or add the
  items by hand.", same two actions. Clears the marker on either.

### B.7 Reveal (processing → editor)

Wrap the review body in `LayoutGroup` + `AnimatePresence mode="wait"`:

1. `ProcessingScreen` exits (`softExit`).
2. `BillScreen` enters. The header's `trailing` slot renders `ReceiptPhotoThumb` with
   `layoutId="receipt-photo"` — motion morphs the big photo into the 44px thumbnail.
3. `AuditLineItems` rows use `revealContainer`/`revealRow` on first mount after a reveal only
   (prop `animateIn`), so normal edits don't re-stagger.
4. The dock's collapsed `AnimatedAmount` counts up from 0 (it already animates value changes;
   mount it with `initialValue={0}` on reveal).
5. The dock enters with `fadeRise` (translate from `y: 24`), after the rows (delay
   `0.1 + rows × 0.05`, capped at 0.6s).
6. `NEEDS_REVIEW`: rows whose item has `confidence < LOW_CONFIDENCE_THRESHOLD` or an
   implausible LBP total get `pulseOnce` after the stagger. (Threshold constants move from
   `convex/bills/extraction.ts` to `src/lib/bill/constants.ts` so the UI can import them.)

`ReceiptPhotoThumb`: 44px square, `surface-inset`, tap opens a `BottomSheet` with the full
photo and the line "Kept on this device only for this session — it is not stored." Renders
only while `job.previewUrl` exists. Not shown for manual/demo bills.

### B.8 Landing side

- `ScanReceiptActions.confirmPhoto`: `const billId = await startScan(pending.file)` →
  `navigate({ to: '/review/$billId', params })`. The dialog closes because the landing route
  unmounts. Keep `inFlight` guards. Set `viewTransitionName: 'receipt-photo'` on the preview
  `<img>` only while `inFlight` (so the shared element exists exactly once).
- The dialog's "Uploading receipt…" state shrinks to the ~200ms of `createBill`; label it
  "Starting…".
- `RecentBills` and `useManualBill` unchanged here (gating is Phase C).

### B.9 Acceptance criteria

- After tapping "Use this photo", the URL is `/review/<id>` within ~300ms and the user sees
  their photo being scanned; the editor is never visible while `imageRef` is set.
- Typing during a scan is impossible; a scan that takes 15s shows the escape hatch at 10s;
  using it lands in the empty editor and the later vision result does **not** overwrite it
  (verify in the Convex dashboard: `imageRef`/`extractionRunId` cleared, `applyExtraction`
  early-returns).
- Kill the network mid-upload → `failed` surface with Scan again / Enter manually. Refresh
  mid-upload → `photo-lost` surface. Manual and demo bills → straight to the editor, no
  processing frame, no thumbnail.
- Extraction success → rows stagger in, total counts up, dock rises last, photo morphs into
  the header thumbnail; tapping it shows the photo with the disclosure. After a page refresh
  the thumbnail is gone.
- `NEEDS_REVIEW` result → flagged rows pulse once.
- Reduced motion: no beam, no stagger, immediate swap.
- `pnpm build` passes; `npx convex dev` deploys `abandonExtraction` with validators.

---

## 6. Phase C — Route transitions + step gating

**Goal.** Moving between review, split and summary reads as one surface: header and dock
morph, the page slides in the direction of travel, the total travels with you. Steps you
cannot take yet are visibly locked, and resuming a bill lands on the step its status implies.

### C.1 Files

New
- `src/lib/ui/viewTransitions.ts` (§3.3), exported from `~/lib/ui`
- `src/lib/bill/steps.ts` — `stepAvailability(bill)`, `resumeStepFor(status)`, exported from
  `~/lib/bill`

Modified
- `src/router.tsx` — `defaultViewTransition: { types: ({ fromLocation, toLocation }) =>
  transitionTypes(fromLocation?.pathname, toLocation.pathname) }`
- `src/styles/app.css` — `/* view transitions */` block (C.2)
- `src/routes/__root.tsx` — `<main style={{ viewTransitionName: 'page' }}>`
- `src/routes/review/$billId.tsx`, `split/$billId.tsx`, `summary/$billId.tsx` — add
  `loader: ({ context, params }) => context.queryClient.ensureQueryData(billQueries.detail(params.billId))`;
  summary/split add a `beforeLoad` redirect (C.4)
- `src/components/shared/AppHeader.tsx` — `viewTransitionName: 'app-header'`, gated menu
  items (C.4), `viewTransition` on `Link`s is not needed (default applies)
- `src/components/features/bill/workspace/SplitHero.tsx`,
  `review/components/ReviewDock.tsx`, `summary/components/SettlementHeader.tsx` (Phase D; in
  Phase C the summary grand total row) — `bill-total` name on the headline amount wrapper
- `src/components/features/scan/components/RecentBills.tsx` — resume by status (C.4)
- `src/components/features/split/SplitPage.tsx` — after `finalize` succeeds, `navigate` to
  summary (already does; the type resolves to `step-forward` automatically)

### C.2 CSS

```css
/* view transitions */
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-group(*) {
    animation-duration: 320ms;                       /* ROUTE_TRANSITION_MS */
    animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  /* header + dock: geometry morph only (default group animation), no fade jump */
  ::view-transition-old(app-header), ::view-transition-new(app-header),
  ::view-transition-old(dock),       ::view-transition-new(dock) {
    animation-duration: 320ms;
  }
  /* the total travels: default morph + the number crossfades */
  ::view-transition-group(bill-total) { animation-duration: 360ms; }

  html:active-view-transition-type(step-forward) {
    &::view-transition-old(page) { animation: 220ms ease-out both vt-out-left; }
    &::view-transition-new(page) { animation: 320ms cubic-bezier(0.2,0,0,1) both vt-in-right; }
  }
  html:active-view-transition-type(step-back) {
    &::view-transition-old(page) { animation: 220ms ease-out both vt-out-right; }
    &::view-transition-new(page) { animation: 320ms cubic-bezier(0.2,0,0,1) both vt-in-left; }
  }
  html:active-view-transition-type(takeover) {
    &::view-transition-old(page) { animation: 200ms ease-out both vt-fade-out; }
    &::view-transition-new(page) { animation: 320ms cubic-bezier(0.2,0,0,1) both vt-fade-in; }
    &::view-transition-group(receipt-photo) { animation-duration: 420ms; }
  }
  html:active-view-transition-type(crossfade) {
    &::view-transition-old(page) { animation: 160ms ease-out both vt-fade-out; }
    &::view-transition-new(page) { animation: 220ms ease-out both vt-fade-in; }
  }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation-duration: 120ms; }
  ::view-transition-old(*), ::view-transition-new(*) { animation-name: vt-fade-out, vt-fade-in; }
}
@keyframes vt-out-left  { to   { opacity: 0; transform: translateX(-6%); } }
@keyframes vt-in-right  { from { opacity: 0; transform: translateX(6%); } }
@keyframes vt-out-right { to   { opacity: 0; transform: translateX(6%); } }
@keyframes vt-in-left   { from { opacity: 0; transform: translateX(-6%); } }
@keyframes vt-fade-out  { to   { opacity: 0; } }
@keyframes vt-fade-in   { from { opacity: 0; } }
```

Notes
- `<main>` is the only element named `page`; because header and dock have their own names
  they are excluded from `page` and morph independently.
- The `Toaster` gets `view-transition-name: none` (no snapshot flicker for a live toast).
- Nested `AnimatePresence` inside pages must not animate on the route-transition frame; the
  reveal in B.7 is keyed on the processing state, not on mount, so it does not fire on
  step navigation.

### C.3 Data readiness

Every `$billId` route gets the loader above so `useSuspenseQuery` never suspends during a
step transition (the query is already in the cache from the previous step; the loader is for
direct loads and the landing→review takeover). `pendingComponent` stays as the fallback for
cold loads. `pendingMs` default (1s) is fine; do not lower it.

### C.4 Gating (`src/lib/bill/steps.ts`)

```ts
export type BillStep = 'review' | 'split' | 'summary'      // move the type here from session/billHistory.ts and re-export
export interface StepAvailability { enabled: boolean; reason?: string }
export function stepAvailability(bill: { status: BillStatus; lineItems: { length: number }; imageRef?: string | null }):
  Record<BillStep, StepAvailability>
//  review:  always enabled
//  split:   disabled if imageRef (extracting) → 'Still reading the receipt'
//           disabled if lineItems.length === 0 → 'Add items first'
//  summary: disabled unless status === 'FINALIZED' → 'Finalize the split to unlock'
export function resumeStepFor(status: BillStatus): BillStep
//  FINALIZED → 'summary'; READY | PUBLISHED → 'split'; PENDING | NEEDS_REVIEW → 'review'
```

Consumers
- `AppHeader` dropdown: uses `useQuery(billQueries.detail(billId))` (already cached by the
  route) → disabled `DropdownMenuItem` with the reason as a second line, `aria-disabled`.
- `RecentBills`: entries still store `step` for the label, but `openBill` fetches the bill
  (`queryClient.ensureQueryData`) and navigates to `resumeStepFor(bill.status)`; if the fetch
  fails (deleted/expired) toast and remove the entry.
- Routes: `split/$billId` and `summary/$billId` `beforeLoad` load the bill and `redirect` to
  the highest enabled step ≤ the requested one (summary → split → review). Host-token checks
  stay in `HostAccessBoundary`.
- `SummaryPage`: remove the "live preview" alert and any pre-finalize branch; `finalized` is
  now invariant there (guests still read finalized summaries via `/join`).
- `SplitPage` `actionSlot` when finalized: "View final summary" stays (it is now the only
  way forward and the transition type will be `step-forward`).

### C.5 Acceptance criteria

- Review → Split: header and dock hold position and morph; content slides in from the right;
  the total visibly moves from the review dock to the `SplitHero`. Split → Review: reverse.
  Browser back/forward produce the mirrored direction.
- Landing → Review after confirming a photo: the preview image expands into the processing
  screen (no cut).
- No `Loader` flash on any step navigation; a direct load of `/split/<id>` shows `Loader` at
  most once.
- Header menu shows Split disabled with "Add items first" on an empty bill and Summary
  disabled with "Finalize the split to unlock" on a live split; `/summary/<id>` for a
  non-finalized bill redirects to `/split/<id>`.
- Recent bills: a finalized bill opens on summary regardless of the stored step.
- `prefers-reduced-motion: reduce` → 120ms crossfades only. Safari 18 / Chrome Android:
  no white flash; in-app browsers without VT: hard cut, no errors.
- `pnpm build` passes.

---

## 7. Phase D — Summary redesign

**Goal.** Summary is the **settlement** screen you land on after finalizing: who still owes,
how much, and one tap to send each person their own receipt. Guests see the same finalized
summary on `/join`.

### D.1 Files

New
- `src/components/features/summary/components/SettlementHeader.tsx` — progress ("3 of 5
  settled"), outstanding total (USD headline, LBP under; `bill-total` name), animated
  progress bar (`motion`, `pillSpring`)
- `src/components/features/summary/components/SettlementList.tsx` — per-person rows
  (extends `PortfolioReceipt`) sorted unpaid first, each with paid toggle + **Send**
- `src/components/features/summary/components/SummaryDock.tsx` — collapsed: **Share all
  totals** (primary) + **QR** (secondary); panel: `SettlementHeader` details + rate + tip note
- `src/components/features/summary/content.ts` — copy (created in A; extended)
- `src/lib/format/shareText.ts` → `buildPersonMessage(bill, personId, opts)` (pure; unit-testable
  by hand in `/tmp` — no test runner in repo)
- `src/lib/money/split.ts` or `src/lib/bill/settlement.ts` → `settlementProgress(bill)`:
  `{ settled, total, outstandingLbp, outstandingUsd }` (pure, shared with join)

Modified
- `src/components/features/summary/SummaryPage.tsx`
- `src/components/features/bill/receipt/PortfolioReceipt.tsx` — optional `onSend`,
  `sendPending` props (icon button `RiSendPlaneLine`, 44px hit area)
- `src/components/features/bill/summary/BillSummary.tsx` — accepts `sortUnpaidFirst`,
  `onSend`, and a `header` slot so `/join` can render the same settlement view
- `src/components/features/join/JoinPage.tsx` — finalized branch uses `SettlementHeader` +
  `BillSummary` with `canTogglePaid` for own people (existing) and `onSend` for own people only

### D.2 Behavior

- **Sorting**: unpaid portfolios first (by outstanding LBP desc), then paid (by `paidAt` asc).
  `people` who claimed nothing are listed last under a muted "Nothing claimed" group.
- **Paid toggle**: existing `setHostPersonPaid` / `setGuestPersonPaid`; the row animates to
  its new group with `layout` (`sheetSpring`), progress header counts up.
- **Send** (host): `navigator.share({ text: buildPersonMessage(bill, personId, { joinUrl }) })`
  on the tap (iOS user-gesture rule). Fallback: clipboard + toast "Copied <name>'s total".
  Message shape:

  ```
  🧾 <merchant> — your share
  • 1 × Chicken taouk        $10.00 / 900,000 LL
  • ½ × Fries for the table  $3.35 / 300,000 LL
  Service & tax              $1.30 / 117,000 LL
  Tip (10%)                  $1.47 / 131,700 LL
  Total: $16.12 / 1,448,700 LL
  <paymentNote if set — D.4>
  See the receipt: <joinUrl>
  ```
- **Share all totals**: existing `buildTotalsMessage`, unchanged.
- **QR**: `ShareSplitDialog` (moved in A.6). `onRevoke` is hidden on finalized bills (already).
- Marking everyone paid → `SettlementHeader` shows "All settled" with a single `popIn`
  check; dock primary label stays.
- The read-only `ReadOnlyNotice` (someone without the host token) renders in the notice slot;
  Send/paid controls hidden.

### D.3 Acceptance criteria

- Finalizing on split lands on summary with `step-forward`; the outstanding total is the
  travelling `bill-total`.
- Each unpaid person has a Send that opens the share sheet with only their lines; on desktop
  it copies and toasts.
- Toggling paid reorders rows with motion and updates "n of m settled" and the outstanding
  amount live (Convex push; verify with two devices).
- `/join/<token>` for a finalized bill shows the same header and list; guests can only toggle
  paid / send for people they control.
- No pre-finalize UI remains in `summary/`.
- `pnpm build` passes.

### D.4 Follow-up (separate PR): "Pay me via"

- `convex/schema.ts`: `paymentNote: v.optional(v.string())` on `bills` (max 140 chars,
  validated in `convex/model/bills.ts`).
- `convex/bills/host/lifecycle.ts`: `setPaymentNote` via `billMutation` (allowed on
  `FINALIZED`; it does not alter amounts) with a version bump.
- `src/api/billMutations.ts`: `useSetPaymentNote`.
- Summary dock panel: a `BlurCommitInput` "How should people pay you? (Whish, OMT, cash…)".
- `buildPersonMessage` / `buildTotalsMessage` append it when set. Guest queries already return
  the bill; confirm `paymentNote` is included in the public projection
  (`convex/bills/lib/validators.ts`).

---

## 8. Phase E — Desktop parity (last)

**Goal.** Desktop consumes the same content modules; nothing desktop-specific is designed.

- `BillScreen.aside` renders the dock's `*Panel` content in a `surface-panel` sticky column at
  `lg:` (review: `ReviewSettlementPanel` + total + Proceed; split: person panel + tip + action
  slot as today; summary: `SettlementHeader` details + share actions).
- The `Dock` has `mobileOnly` (default true) so it never mounts at `lg:`; the `dock`
  view-transition name is therefore absent on desktop and the `page` slide still applies.
- Header identical. Modal `BottomSheet` centers as a dialog at `sm:` and up (`responsive`).
- Remove any remaining desktop-only duplicates (`SettlementSummary` becomes a thin wrapper or
  is deleted in favor of `BillScreen.aside`).

Acceptance: at 1280px every bill screen has header / main / sticky aside with the same panel
content as the mobile dock panel; no layout regressions vs. today's desktop; `pnpm build`.

---

## 9. Appendix

### 9.1 Backlog (not scheduled)

- Receipt export as image (canvas render of the settlement list) for the group chat.
- Header progress line (thin bar under `AppHeader` filling by step) — only if the dropdown
  proves too hidden.
- `tapHaptic()` on every primary dock CTA (cheap; can ride along with Phase A if desired).
- `ReceiptPlayground` on the landing page could morph into the real review via the same
  `takeover` type when "Try a sample bill" is tapped.
- Server-side `source: 'scan' | 'manual'` on `createBill` to replace the sessionStorage
  photo-lost marker if it proves flaky.
- `scan/content.ts` still has unused keys (`readyStatus`, `scanningStatus`, `primaryAction`);
  prune with Phase B.

### 9.2 Risks and how to check them early

- **Portaled dock + view transitions.** The dock is rendered into `body` via `Drawer.Portal`.
  Named elements are snapshotted regardless of DOM position, but iOS Safari has had bugs with
  `position: fixed` snapshots. Build the `Dock` in Phase A with the first-paint offset and test
  a review→split transition on a real iPhone **before** writing the rest of Phase C's CSS. If
  it is not continuous, switch to the root-level `DockHost` escape valve (content contract is
  the same; pages pass content through context instead of rendering `<Dock/>`).
- **Two elements with the same `view-transition-name`** abort the transition silently
  (falls back to a cut). `bill-total` must be set on exactly one visible element per screen;
  desktop asides must not also carry it.
- **`motion` `layoutId` across `AnimatePresence mode="wait"`**: the thumbnail must mount in
  the same `LayoutGroup` as the processing photo; keep both under `ReviewPage`, not inside
  `BillScreen` internals.
- **`retrier.cancel` throws if the run is not executing** — `abandonExtraction` wraps it;
  correctness does not depend on the cancel succeeding.
- **`base-ui` Drawer snap-point offset on first paint** — the declared `collapsedHeightHint`
  must be within a few px of reality or the dock visibly jumps once. Measure on a 390px
  viewport with the real fonts and record the constants next to the content module.
- **Hydration**: `ProcessingScreen` decides on `sessionStorage`/module state; render the
  `ReceiptScan` fallback on the server and switch after mount to avoid mismatch warnings.

### 9.3 QA checklist per phase (mobile Safari + Chrome Android, 390×844)

- Dock: first frame after navigation correct; swipe up/down; keyboard open with inline add-
  person; safe-area on a notch device; dark mode shadow ring.
- Transitions: forward, back, browser back, deep link, reduced motion, in-app browser.
- Processing: fast network, throttled 3G, offline mid-upload, refresh mid-upload, slow hint,
  abandon, NEEDS_REVIEW result, vision failure, rate-limit `ConvexError`.
- Summary: two devices toggling paid; share sheet on iOS; clipboard fallback on desktop.
- Always: `pnpm build` (the typecheck), `npx convex dev` deploys with validators on every new
  public function.

### 9.4 Facts this plan relies on (verified 2026-09-11)

- `@tanstack/react-router` 1.170 / `router-core` 1.171: `RouterOptions.defaultViewTransition?:
  boolean | { types: string[] | ((info: { fromLocation?, toLocation, pathChanged, hrefChanged,
  hashChanged }) => string[]) }`; the router calls `document.startViewTransition({ update, types })`
  when supported and falls back to a plain navigation otherwise.
- `@base-ui/react` 1.5 `Drawer`: `snapPoints`, `snapPoint`, `snapToSequentialPoints`,
  `onSnapPointChange`, `--drawer-snap-point-offset`, `--drawer-swipe-movement-y`,
  `--drawer-swipe-progress` (all already used by `MobileSplitSheet`).
- `@convex-dev/action-retrier` 0.3: `retrier.cancel(ctx, runId)` exists and throws if the run
  is not executing.
- `convex/bills/extraction.ts`: `applyExtraction` returns early if `bill.imageRef !== imageRef`;
  `canApplyExtraction` requires `bill.version === bill.extractionBaseVersion`, else
  `clearExtraction`; `onExtractionComplete` maps run → bill via `by_extractionRunId`.
- `useBillEditor` flushes on `pagehide`, `visibilitychange`, `online`, unmount; `extracting =
  Boolean(serverDoc.imageRef)`.
- `motion` 12.40, React 19, Tailwind 4.2 (`@utility` available), `react-hot-toast`.
- No test runner and no lint in the repo; verification is `pnpm build` plus manual QA.
