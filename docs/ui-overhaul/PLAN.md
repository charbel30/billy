# Billy UI/UX Overhaul — Phased Plan

## Scope of execution

This plan covers **both** halves of what was decided: the **foundation first** (Phase 1: tokens/typography/theme toggle/hardcode sweep; Phase 2: motion system + shared state components) and then the **full component overhaul** (Phases 3–6: scan, review, split, summary+join screen passes; Phase 7: a11y/polish sweep).

Execution order: phases run in order, committing at each phase boundary (Phase 1 gets two commits as noted). Each phase must end green on `pnpm build` before moving on.

## Progress

- [x] Phase 1a — tokens, typography, theme toggle
- [x] Phase 1b — hardcode sweep (colors/shadows/radii, ~25 files)
- [x] Phase 2 — motion presets + shared state components (EmptyState, Alert variants, Loader)
- [x] Phase 3 — scan screen pass
- [x] Phase 4 — review screen pass
- [x] Phase 5 — split screen pass
- [ ] Phase 6 — summary + join pass
- [ ] Phase 7 — a11y + final polish sweep

## Context

Billy's flows (scan → review → split → summary → join) work end-to-end, but the UI doesn't yet feel like a polished product: the entire app is set in Cascadia Mono (a coding font), ~17 hardcoded color usages (amber/emerald warnings, `bg-white` cards, hex person colors) break dark mode, 15+ ad-hoc inline shadows and mixed radii (2xl/3xl/4xl/[2rem]) make surfaces inconsistent, only 2 motion presets exist, there are no skeletons/empty-state components, no theme toggle, no `prefers-reduced-motion` support, and summary/join have no desktop layout. The app serves free consumers **and** restaurants printing table QR codes — both mobile-first.

**Direction (user-decided):** Modern SaaS clean (refined warm-neutral base + one confident gold accent, generous whitespace, soft layered shadows) · Figtree sans for UI + Cascadia Mono reserved for amounts/receipt lines ("printed receipt" character) · phased foundation-first · dark mode first-class with a system/light/dark toggle.

**Verification everywhere:** no test runner exists — each phase must pass `pnpm build` (the typecheck) and a manual `pnpm dev` walkthrough at ~390px and desktop, in all three theme modes. Frontend-only; Convex untouched; `routeTree.gen.ts` untouched; no new dependencies (Figtree already installed); constants per CLAUDE.md contract (`lib/bill/constants.ts`, feature `content.ts`, `lib/animations.ts`). Consult `.claude/skills/make-interfaces-feel-better` during implementation.

Two verified findings that shape Phase 1:
- `src/styles/app.css:35-52` — a second `@layer base` block hardcodes `gray-200/gray-800` borders and `gray-50/gray-950` body colors, silently overriding the semantic tokens. Must be **deleted** (keep `color-scheme`, move into the first base block). It also holds `.using-mouse * { outline: none !important }` → replaced in Phase 7.
- Person `color` is **persisted as hex** in Convex (`convex/schema.ts`, assigned by `nextPersonColor` in `src/lib/bill/ids.ts`). Person-color tokens must be a render-time hex→CSS-var mapping — no data change.

---

## Phase 1 — Foundation: tokens, typography, theme toggle, hardcode sweep

### 1a. Token overhaul — `src/styles/app.css`

Delete the conflicting base block (lines 35–52, see above).

**Accent: keep the yellow, refined into "receipt gold".** It's already the brand and is distinctive on printed table QR cards vs generic SaaS blue. Since gold at L 0.85 can't be text/ring on white, use a **two-tier accent**: `--primary` (fill) + `--primary-strong` (text/links/rings/active icons). Changing direction later = changing 2 vars.

New/changed `:root` tokens (hues fixed; implementer may fine-tune L/C by eye):

```css
/* warm neutrals (hue ~85, chroma 0.003–0.006 — warm paper, not blue-gray) */
--background: oklch(0.98 0.004 85);   --foreground: oklch(0.19 0.006 85);
--card: oklch(1 0 0);                 --muted: oklch(0.955 0.004 85);
--muted-foreground: oklch(0.49 0.014 85);
--border: oklch(0.905 0.006 85);      --input: oklch(0.905 0.006 85);

/* two-tier accent */
--primary: oklch(0.84 0.17 89);            /* refined gold fill */
--primary-foreground: oklch(0.30 0.07 70); /* deep umber ink on gold */
--primary-strong: oklch(0.54 0.12 80);     /* text/links/rings */
--ring: var(--primary-strong);

/* semantic status — replaces every amber-*/emerald-* utility */
--success: oklch(0.60 0.14 155);           --success-foreground: oklch(0.98 0.01 155);
--success-subtle: oklch(0.95 0.035 155);   --success-subtle-foreground: oklch(0.38 0.09 155);
--warning: oklch(0.76 0.14 75);            --warning-foreground: oklch(0.29 0.07 60);
--warning-subtle: oklch(0.965 0.04 85);    --warning-subtle-foreground: oklch(0.45 0.10 70);
--destructive-subtle: oklch(0.955 0.025 25); --destructive-subtle-foreground: oklch(0.44 0.16 25);
--info-subtle: oklch(0.955 0.02 250);      --info-subtle-foreground: oklch(0.42 0.10 250);

/* shadow scale — layered + transparent */
--shadow-card:       0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px rgb(0 0 0 / 0.06);
--shadow-card-hover: 0 2px 5px rgb(0 0 0 / 0.07), 0 14px 36px rgb(0 0 0 / 0.09);
--shadow-raised:     0 1px 3px rgb(0 0 0 / 0.08), 0 16px 44px rgb(0 0 0 / 0.10);
--shadow-overlay:    0 4px 10px rgb(0 0 0 / 0.08), 0 24px 60px rgb(0 0 0 / 0.16);
--shadow-dock:       0 -6px 16px rgb(0 0 0 / 0.05), 0 -18px 48px rgb(0 0 0 / 0.09);

/* person palette — L/C-normalized so all 8 read equal weight; mapped from stored hex */
--person-1: oklch(0.62 0.19 25);  /* ← #ef4444 */   --person-2: oklch(0.71 0.15 70);  /* ← #f59e0b */
--person-3: oklch(0.65 0.13 160); /* ← #10b981 */   --person-4: oklch(0.60 0.16 255); /* ← #3b82f6 */
--person-5: oklch(0.58 0.19 295); /* ← #8b5cf6 */   --person-6: oklch(0.64 0.20 355); /* ← #ec4899 */
--person-7: oklch(0.66 0.11 190); /* ← #14b8a6 */   --person-8: oklch(0.68 0.17 50);  /* ← #f97316 */
--person-fallback: oklch(0.62 0.01 85);              /* ← '#999' */

/* radius rationalization */
--radius: 0.625rem;          /* keep base */
--radius-card: 1.25rem;      /* THE card radius */
--radius-control: 0.75rem;   /* THE control radius: inputs, chips, small buttons */
```

`.dark` counterparts: warm-dark neutrals (`--background: oklch(0.16 0.005 85)`, `--card: oklch(0.21 0.006 85)`, border/input as white-alpha), `--primary: oklch(0.80 0.15 88)`, `--primary-strong: oklch(0.79 0.12 85)` (lighter, text-capable on dark), status +≈0.1 L with subtle variants as low-alpha (e.g. `--success-subtle: oklch(0.60 0.14 155 / 12%)`), person colors +0.06 L / −0.02 C, shadows go mostly-ring: `--shadow-card: 0 0 0 1px oklch(1 0 0 / 0.06), 0 12px 32px rgb(0 0 0 / 0.45)` etc.

Register in `@theme inline` so utilities exist: `--color-success(-foreground/-subtle/-subtle-foreground)`, same for warning / destructive-subtle / info-subtle, `--color-primary-strong`, `--color-person-1…8`, `--shadow-card/-card-hover/-raised/-overlay/-dock`, `--radius-card`, `--radius-control` → yields `bg-success-subtle`, `shadow-card`, `rounded-card`, `rounded-control`, etc.

**Person color plumbing** — `src/lib/bill/constants.ts`: keep `PERSON_COLORS` hexes (persisted data), add:

```ts
export const PERSON_COLOR_VARS: Record<string, string> = { '#ef4444': 'var(--person-1)', /* …all 8 */ }
export function personColorValue(hex: string | undefined): string {
  return (hex && PERSON_COLOR_VARS[hex]) ?? hex ?? 'var(--person-fallback)'
}
```

Route every `style={{ backgroundColor: person.color }}` consumer through it: `PersonAvatar.tsx` (incl. `DEFAULT_PERSON_COLOR`), `PersonBarPill.tsx`, `PersonPanelRow.tsx`, `ClaimListItem.tsx` (grep `person.color` / `\.color`).

**ELEVATED_CARD retirement**: redefine `ELEVATED_CARD` / `ELEVATED_CARD_HOVER` constants (in `features/bill`) as `'rounded-card border border-border bg-card shadow-card'` / `'hover:shadow-card-hover hover:border-foreground/15 transition-[box-shadow,border-color]'` — keep the names so call sites don't churn.

### 1b. Typography

In `app.css`:
- `@import '@fontsource-variable/figtree';` alongside Cascadia.
- `--font-sans: 'Figtree Variable', system-ui, sans-serif`; `--font-heading: var(--font-sans)`; add `--font-mono: 'Cascadia Mono Variable', ui-monospace, monospace`.
- One utility:
  ```css
  @utility font-receipt {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  ```
- Remove the inline Figtree style in `src/components/features/scan/ScannerHub.tsx` (~line 110).

Type-scale roles (convention applied during screen phases, no extra utilities):

| Role | Recipe |
|---|---|
| Page title | `text-2xl font-bold tracking-tight` |
| Section label | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Card title | `text-[15px] font-semibold` |
| Body | `text-sm` |
| Caption | `text-xs text-muted-foreground` |
| Amount hero | `font-receipt text-3xl font-semibold` |
| Amount line | `font-receipt text-sm` |

`font-receipt` targets: `ui/animated-amount.tsx`, receipt line items and prices in `PortfolioReceipt.tsx`, `SplitHero.tsx`, `review/SettlementSummary.tsx`, `review/AuditLineItems.tsx` (+ `ItemPrice`/`ReceiptLines` if present in `features/bill`). Everything else becomes Figtree automatically.

### 1c. Theme toggle (system/light/dark)

- `src/lib/theme.ts` (new, pure): `type ThemePreference = 'system' | 'light' | 'dark'`, storage key `billy:theme`, `resolveTheme()`, `applyTheme()`, and `THEME_INIT_SCRIPT` — minified IIFE reading localStorage + `matchMedia('(prefers-color-scheme: dark)')`, toggling `document.documentElement` `.dark` class + `style.colorScheme`.
- `src/routes/__root.tsx`: `suppressHydrationWarning` on `<html>`; `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />` in `<head>` **before** `<HeadContent />` (verified: `RootDocument` at lines 82–98 controls the raw shell) — no FOUC.
- `src/hooks/useTheme.ts` (new, cross-feature per contract): preference state, persistence, `matchMedia` listener while on `system`.
- `src/components/shared/ThemeToggle.tsx` (new): icon button using existing `ui/dropdown-menu.tsx` (RiSunLine / RiMoonLine / RiComputerLine), ≥40×40 hit area, icon `swap` animation.
- `src/components/shared/AppHeader.tsx`: 3-slot `justify-between` (brand left, step pills center, ThemeToggle right).

### 1d. Hardcoded color/shadow/radius sweep (mechanical; this is what fixes dark mode)

| Target | Replacement |
|---|---|
| `amber-*` in `features/bill/BillSummary.tsx` (~:68), `BillSplitWorkspace.tsx`, `review/AuditLineItems.tsx` | `bg-warning-subtle text-warning-subtle-foreground` (Alert component lands Phase 2) |
| `emerald-*` in `WorkspaceHeader.tsx`, `PortfolioReceipt.tsx`, `SplitSheetHandle.tsx` | success / success-subtle tokens |
| `bg-white` in `ShareSplitCard.tsx` (:77, :180) | QR tile keeps **intentional** literal white behind the QR (comment why: scanner contrast) + `outline outline-black/10 dark:outline-white/10`; other `bg-white` → `bg-card` |
| Purple shadow `rgba(79,55,138,0.10)` in `SplitHero.tsx:29` | `shadow-card` |
| All ~15 inline `shadow-[...]` | nearest of `shadow-card/-card-hover/-raised/-overlay/-dock`; `AppHeader.tsx:79` pill → `shadow-sm` |
| ~60 `rounded-2xl/3xl/4xl/[2rem]` across features | outer cards/sheets → `rounded-card`; inner tiles/inputs/chips → `rounded-control`; concentric rule for nested (inner = `rounded-[calc(var(--radius-card)-0.5rem)]` when padding < 8px); pills stay `rounded-full` |
| gray/white literals in `DefaultCatchBoundary.tsx`, `NotFound.tsx` | semantic tokens |
| `Toaster` in `__root.tsx` | `toastOptions={{ style: { background: 'var(--card)', color: 'var(--card-foreground)', boxShadow: 'var(--shadow-raised)', borderRadius: 'var(--radius-control)' } }}` |

Commit tokens+typography+toggle first, then the sweep as a second commit.

**Verify:** `pnpm build`; walk all 5 screens at 390px + desktop; all 3 theme modes; hard-reload on dark (no FOUC); no amber/emerald/white patches in dark; QR scans; amounts mono, UI Figtree.

---

## Phase 2 — Foundation: motion system + shared state components

### 2a. Motion presets — `src/lib/animations.ts` (keep `swap`, `pillSpring`)

- `fadeRise` — `{ initial: { opacity: 0, y: 10, filter: 'blur(2px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: spring 0.45, bounce 0 }` — page/section enter.
- `softExit` — `{ opacity: 0, y: 4 }` — exits softer than enters.
- `staggerContainer` / `staggerChild` — variants pair, `staggerChildren: 0.08` — lists/heros.
- `press` — `whileTap: { scale: 0.96 }`, spring 0.25 — motion buttons; non-motion buttons use `active:scale-[0.96] transition-transform`.
- `sheetSpring` — `{ type: 'spring', stiffness: 380, damping: 38 }` — dock expand/collapse, RateField disclosure.
- `popIn` — scale 0.9→1, spring 0.35, bounce 0.15 — newly added person pills.

### 2b. Reduced motion

- `<MotionConfig reducedMotion="user">` wrapping `AppLayout` in `__root.tsx`.
- `app.css`: `@media (prefers-reduced-motion: reduce)` disabling `.animate-pulse` + viewfinder shimmer (`[data-shimmer]`). Plain spinner stays.

### 2c. Shared state components

- `src/components/shared/EmptyState.tsx` (new): `{ icon, title, hint?, action? }` — muted icon disc, card-title, caption, optional action; `fadeRise` enter.
- **Extend existing `ui/alert.tsx`** CVA with `info | warning | success | destructive` variants on the subtle tokens (no new component). All ad-hoc amber/pink boxes migrate to it in their screen phases.
- `src/components/shared/Loader.tsx`: token-based spinner (`border-muted border-t-primary-strong`), `size` prop, optional label.
- Skeletons: keep `ui/skeleton.tsx`; per-feature skeleton components arrive in their phases. Rule: mirror real layout (same radii/heights), 2–3 rows, no full-page skeletons.

**Verify:** `pnpm build`; OS reduce-motion on → no transform animations, app fully usable.

---

## Phase 3 — Scan screen (`src/components/features/scan/`)

1. `ScannerHub.tsx`: staggered hero enter (`staggerContainer` over title/viewfinder/actions/recent panel).
2. `ScannerViewfinder.tsx`: clamp width on wide screens (`max-w-sm mx-auto lg:max-w-md`); shimmer reduced-motion-gated; image outline on captured preview (`outline-black/10 dark:outline-white/10`); corner brackets → `primary-strong`.
3. `ScanActions.tsx`: CTA gets `press` + `tapHaptic()` (same helper ClaimList uses); upload error → `<Alert variant="destructive">` with retry, replacing bare text.
4. `RecentScanPanel.tsx`: new `RecentScanSkeleton.tsx`; `EmptyState` (RiReceiptLine; copy in `content.ts`); row hover `bg-muted/60` + `active:scale-[0.98]`; staggered entry with `initial={false}` after first render; status chips on success/warning tokens.
5. `ResumeBillCard.tsx`: `shadow-card` + hover, press scale, amounts `font-receipt`.

**Verify:** `pnpm build`; scan end-to-end; empty vs populated history; both themes; upload-failure path shows Alert.

## Phase 4 — Review screen (`src/components/features/review/` + `ui/blur-commit-input.tsx`)

1. `blur-commit-input.tsx`: real editable affordance — resting `bg-muted/50 rounded-control`, `focus-visible:ring-2 ring-ring/50 bg-card`, `font-receipt` when numeric; brief `bg-success-subtle` commit flash (CSS transition, interruptible).
2. `AuditLineItems.tsx`: read-only unit price → plain `font-receipt text-muted-foreground` (not input-shaped); desktop rows get a column-label header (Item/Qty/Unit/Total) + comfortable row height; low-confidence flag → `bg-warning-subtle` badge with RiErrorWarningLine; extract sub-components if file exceeds ~300 lines (per contract).
3. Add-item button: standardized dashed `rounded-control border-dashed border-border hover:border-primary-strong/40 hover:bg-muted/50` — matches AddPerson (Phase 5).
4. `ExtractionBanners.tsx` + reconciliation warning → `Alert` info/warning variants; inner amounts `font-receipt`.
5. `RateField.tsx`: disclosure animates with `sheetSpring`; rate-source chips `rounded-full`, selected `bg-primary text-primary-foreground`.
6. Dirty indicator: `useBillEditor` already exposes dirty state — pulsing dot + "Saving…"/"Saved" `swap` in `MobileReviewAction.tsx` and the desktop aside.
7. `MobileReviewAction.tsx`: `shadow-dock`, `rounded-t-card`, safe-area kept, CTA press + haptic, busy icon swap.

**Verify:** `pnpm build`; edit items/qty/prices mobile + desktop; dirty→saved cycle; NEEDS_REVIEW bill shows warning Alert; keyboard pass over inputs.

## Phase 5 — Split screen (`src/components/features/bill/` — biggest screen phase)

1. `ClaimListItem.tsx` pill cleanup: replace conditional-class soup with a local `cva` — `state: unclaimed | claimedByMe | claimedByOther | pending`; claimant tint via `style={{ '--pill-color': personColorValue(color) }}` + `color-mix` classes; keep `swap` morph + haptics; pending pulse CSS-based (reduced-motion gated); stepper buttons ≥40×40.
2. `SplitHero.tsx`: `shadow-card`; remaining amount = amount-hero `font-receipt`; progress bar springs and flips to `bg-success` at 100% with a `swap` check.
3. `MobileSplitSheet.tsx` + `SplitSheetHandle.tsx`: `sheetSpring` expand/collapse; scroll affordance — `overflow-y-auto overscroll-contain` + top/bottom `mask-image` fade when scrollable; `shadow-dock`; ≥44px grab area; live badge → success tokens.
4. `PersonRail.tsx`: panel variant `max-h-[40vh] overflow-y-auto` + fade mask; popover breakdowns clamped `max-w-[calc(100vw-2rem)]` relying on base-ui collision handling (no bottom-sheet rewrite); amounts `font-receipt`.
5. `AddPerson.tsx`: one identity across bar/panel — dashed `rounded-full` chip matching review's add-item; `popIn` on the newly added person.
6. Conflict banner → `Alert variant="warning"` with the person's color dot.
7. `ClaimListSkeleton.tsx` (new): 4 rows mirroring item cards; used by `SplitPage`/`JoinPage` while the bill query resolves.
8. `WorkspaceHeader.tsx`: live indicator → `bg-success-subtle text-success-subtle-foreground` + gently pulsing dot.

**Verify:** `pnpm build`; two-browser live session (host + guest link) — claim morphs, conflict banner, dock drag, panel scroll, dark-mode person colors legible.

## Phase 6 — Summary + Join (`features/summary/`, `features/bill/`, `features/join/`)

1. `SummaryPage.tsx` desktop: `mx-auto w-full max-w-md lg:max-w-5xl lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start` — receipts left (2-col at lg), `ShareSplitCard` sticky right. Mobile unchanged. "Not embarrassing," not a redesign.
2. `PortfolioReceipt.tsx`: line items `font-receipt`; mark-paid on success tokens with `swap` check + `tapHaptic()`; paid card gets `bg-success-subtle/50` wash + "Paid" badge.
3. `BillSummary.tsx`: unclaimed warning → `Alert variant="warning"`; totals = amount-hero.
4. `ShareSplitCard.tsx`: QR on intentional white tile + image outline (from Phase 1); buttons `press`; present-mode portal on tokens (dark-safe); revoke = `text-destructive` ghost + existing dialog confirm.
5. Empty states (no people / nothing claimed) → `EmptyState`.
6. `JoinPage.tsx`: not-open → `EmptyState` (RiDoorLockLine) + info Alert; finalized → Alert("This split is finalized") above summary; name input in a prominent `rounded-card shadow-card` card with strong focus ring; join busy→success `swap` then `fadeRise` workspace reveal; loading = `ClaimListSkeleton`; new `join/content.ts` if copy accumulates.

**Verify:** `pnpm build`; publish → open share link in 2nd browser at phone width; QR scans both themes; present mode; mark-paid roundtrip; revoke → link shows not-open EmptyState.

## Phase 7 — A11y + final polish (whole-app sweep)

1. **Focus:** remove `.using-mouse * { outline: none !important }` from `app.css`; standardize `focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none` (audit hand-rolled buttons, claim pills, SplitSheetHandle, header links).
2. **Touch targets:** ≥40×40 audit — steppers, ThemeToggle, dock handle, recent-scan delete affordances, popover triggers; extend hit areas with pseudo-elements where visuals stay small.
3. **Contrast:** WCAG AA check on every new token pair in both modes (`muted-foreground`/`background`, `warning-subtle-foreground`/`warning-subtle`, `primary-foreground`/`primary`); person colors are fills/dots only, never body text.
4. **tabular-nums audit:** grep every dynamic number (tip %, qty, people counts) → `font-receipt` or `tabular-nums`.
5. **Transition hygiene:** `transition-all` → explicit properties; `AnimatePresence` gets `initial={false}` where default state renders on load.
6. **Concentric radius audit** on every `rounded-card` parent with padded rounded children.
7. RTL stays forced `ltr` (out of scope; note for later).

**Verify:** `pnpm build`; keyboard-only full flow; reduce-motion full flow; Lighthouse a11y on scan + join.

---

## Sequencing & risk

- Phases 1–2 are prerequisites; 3–6 are mutually independent (order matches user-flow priority); 7 last.
- Biggest risk is Phase 1's sweep breadth (~25 files) — mitigated by the two-commit split within the phase.
- No new dependencies; new shadcn primitives via CLI only if needed (none anticipated — alert/dialog/dropdown-menu/skeleton exist).

## Critical files

- `src/styles/app.css` — tokens, fonts, utilities, base-layer fix
- `src/lib/animations.ts` — motion presets
- `src/lib/bill/constants.ts` — person color mapping, ELEVATED_CARD redefinition
- `src/routes/__root.tsx` — theme init script, MotionConfig, Toaster styling
- `src/components/shared/AppHeader.tsx` — 3-slot layout + ThemeToggle
- New: `src/lib/theme.ts`, `src/hooks/useTheme.ts`, `src/components/shared/{ThemeToggle,EmptyState}.tsx`, `features/scan/RecentScanSkeleton.tsx`, `features/bill/ClaimListSkeleton.tsx`

---

## Phase 1 — ordered execution breakdown

**Commit 1 — tokens + typography + theme toggle**
- Task 1.1: `app.css` — delete conflicting `@layer base` block (lines 35–52), moving `color-scheme: light dark` into the first base block; keep `.using-mouse` rule for now (Phase 7 removes it).
- Task 1.2: `app.css` — replace `:root` and `.dark` variable blocks with the new warm-neutral + two-tier gold token set, status tokens, shadow scale, person palette, `--radius-card`/`--radius-control` (full values as specified in PLAN.md Phase 1a).
- Task 1.3: `app.css` — register all new tokens in `@theme inline` (`--color-*`, `--shadow-*`, `--radius-card/control`) so Tailwind utilities exist.
- Task 1.4: `app.css` — add Figtree import, flip `--font-sans` to Figtree, add `--font-mono` (Cascadia), add `@utility font-receipt`; remove the inline Figtree style in `ScannerHub.tsx`.
- Task 1.5: new `src/lib/theme.ts` (ThemePreference type, `billy:theme` key, resolve/apply, `THEME_INIT_SCRIPT` IIFE) + new `src/hooks/useTheme.ts`.
- Task 1.6: `__root.tsx` — `suppressHydrationWarning` on `<html>`, inject `THEME_INIT_SCRIPT` before `<HeadContent />`, style `Toaster` with tokens.
- Task 1.7: new `src/components/shared/ThemeToggle.tsx` (dropdown-menu, 3 options, swap icon animation) + `AppHeader.tsx` 3-slot layout.
- Verify: `pnpm build`; dark hard-reload has no FOUC; toggle cycles system/light/dark and persists.

**Commit 2 — hardcode sweep (~25 files, mechanical)**
- Task 2.1: `src/lib/bill/constants.ts` — add `PERSON_COLOR_VARS` + `personColorValue()`; redefine `ELEVATED_CARD`/`ELEVATED_CARD_HOVER` on new tokens.
- Task 2.2: route all `person.color` inline styles through `personColorValue` (`PersonAvatar`, `PersonBarPill`, `PersonPanelRow`, `ClaimListItem` — grep to confirm full list).
- Task 2.3: amber→warning tokens (`BillSummary`, `BillSplitWorkspace`, `AuditLineItems`); emerald→success tokens (`WorkspaceHeader`, `PortfolioReceipt`, `SplitSheetHandle`).
- Task 2.4: `ShareSplitCard` — intentional white QR tile w/ comment + image outline; other `bg-white`→`bg-card`; `SplitHero` purple shadow→`shadow-card`.
- Task 2.5: replace all ~15 inline `shadow-[...]` with the shadow-scale utilities (grep `shadow-\[`).
- Task 2.6: radius sweep — `rounded-2xl/3xl/4xl/[2rem]` → `rounded-card`/`rounded-control`/`rounded-full` per the outer/inner/pill rule (grep counts ~60).
- Task 2.7: `DefaultCatchBoundary`/`NotFound` gray/white literals → semantic tokens.
- Task 2.8: apply `font-receipt` to amount surfaces (`animated-amount`, `PortfolioReceipt` lines, `SplitHero`, `SettlementSummary`, `AuditLineItems` prices).
- Verify (full checklist): `pnpm build` green; walk scan→review→split→summary→join at 390px and desktop in all 3 theme modes; no amber/emerald/white patches in dark mode; QR still scannable; amounts mono / UI Figtree; person colors legible in both modes.
