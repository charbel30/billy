# Spolio branding before Reddit

Update 2026-09-09: the user selected concept 03’s playful receipt character with
concept 02’s custom lowercase lettering. This supersedes the split-circle identity
decisions below. The current implementation and export instructions are in
`brand/README.md`; the original branding pass is retained below as history.

Status: local implementation complete and verified. Direction approved by the user on 2026-09-08. Not deployed.
Date: 2026-09-08. Complements `launch-plan.md`; does not mark its readiness gates complete.

## What was checked

- Inspected the actual favicon, Apple touch icon, Android icon, and social preview images.
- Rendered the local landing page at 1440px and 390px, including mobile dark mode.
- Confirmed no horizontal overflow at 390px; reduced motion disables the landing entrance.
- Exercised the local receipt playground: adding lemonade changes the share from $11 to $15.
- Read header/navigation, motion presets, scan/extraction feedback, empty states, and metadata source.
- Bill navigation and extraction states were inspected in source, not exercised end to end.
- Local screenshots contain development tools; those are already gated out of production.

## Findings

| Surface | Current state | Proposed treatment |
| --- | --- | --- |
| Favicon and home-screen icons | Tropical island starter artwork unrelated to receipt splitting | Replace the entire family with one recognizable Spolio mark |
| Header | Generic Remix wallet icon beside a bold text wordmark | Reusable custom mark and consistent wordmark lockup |
| Social preview | Custom split-circle letterform, textured wallet illustration | Develop the split motif and bring the preview into the same visual system as the app |
| Landing | Warm yellow, green, paper receipt demo, friendly copy | Preserve the foundation; define clear color and typography roles |
| Positioning | Lebanon and dual currency are distant from the primary mobile pitch | Bring the practical LBP/USD benefit beside the scan action if Lebanon-first positioning is confirmed |
| Navigation | Review/Split/Summary with a moving active pill already exists | Refine compact spacing, active/focus states, and touch targets; retain readable labels |
| Scan feedback | Standard spinner and reading text | One purposeful branded receipt-reading animation with truthful state labels |
| Other motion | Existing price crossfades, sheets, person pills, theme transitions | Review consistency; use restrained confirmation feedback where useful |
| Manifest | White theme/background; no explicit maskable icon | Align colors and provide a separately designed maskable asset |

## Recommended direction

Keep the settled Spolio name. Explore a simple split-circle/S identity derived
from the existing social-card idea, with warm yellow, dark ink, paper surfaces,
and restrained green. Make the symbol recognizable at 16px and in one color.
Test whether it reads as splitting/sharing without relying on a detailed wallet.
Keep the tone friendly and useful, with Lebanon expressed through product
benefits and familiar meals rather than decorative national symbols.

## Proposed sequence

1. Settle identity direction, audience emphasis, and scope in the interview.
2. Present two visual executions of the chosen direction, showing the mark at
   favicon size, in the header, on a phone home screen, and in a social preview.
3. Produce a reusable vector mark/wordmark, monochrome and dark variants,
   favicon SVG/ICO/16px/32px PNG, 180px Apple touch icon, 192px/512px app icons,
   a maskable icon, and a matching 1200x630 social card. Keep editable sources.
4. Integrate the identity across header, metadata, manifest, and shared-link
   preview. Make the landing's audience/value statement consistent.
5. Refine existing navigation motion and add the agreed scan/confirmation
   treatment. Prefer the installed Motion/CSS tools for simple geometry;
   choose Lottie only if the selected artwork benefits from it. Never delay
   navigation or imply measured scan progress that the app does not have.
6. Verify tiny-icon legibility, home-screen cropping, light/dark rendering,
   320–430px navigation fit, touch targets, keyboard focus, reduced motion,
   loading/error/success states, asset URLs, and production build/typecheck.
   Confirm live WhatsApp/Reddit previews after deployment; local rendering
   cannot establish crawler caches or real-device behavior.

## Settled decisions

1. Identity: split-circle. Balanced geometry (A) is the implementation default;
   the offset comparison remains an optional visual preference.
2. Positioning: Lebanon first, English UI.
3. Scope: a thorough pass intended to feel close to final before Reddit,
   including the full brand kit, interface consistency, navigation, and motion.
4. Preserve the current product flow and backend. Branding does not change
   splitting, publishing, payment tracking, or access rules.

## Delivery

Editable assets and usage rules live in `brand/README.md`. Public files are
exported through `scripts/export-brand-assets.mjs`. Open `brand/review.html`
for a responsive asset board, or `brand/preview.png` for the rendered overview.

| Before | After |
| --- | --- |
| Starter island icons and generic wallet header | Balanced split-circle, reusable Brand/BrandSymbol components, SVG wordmarks, complete favicon/touch/app/maskable exports |
| Separate illustrated social identity | Matching receipt-based 1200×630 social preview, versioned public/guest metadata and manifest references |
| Undefined brand reuse | Canonical geometry, editable social source, dependency-free Chromium exporter, brand guide and visual board |
| Lebanon and currency value low on the page | Lebanon-first hero; receipt demo shows both currency totals; matching sticker, steps, and footer identity |
| Gold text and differing accent roles | Gold action fills, readable green links/amounts, unified ink/paper colors and dark equivalents |
| Cramped single-row phone header | Separate mobile step row with 44px targets and retained visible labels; single-row desktop layout |
| Bouncy active pill and unrestricted number/brand motion | Calmer active pill, reduced-motion-safe amounts, scan beam, loading symbol, and brand press states |
| Generic extraction spinner and route loader | Receipt-reading illustration, breathing split-circle loading state, truthful live labels |
| Generic empty/404/error surfaces | Consistent brand treatment and actionable copy; technical error details limited to development |
| Static sharing control and untrapped presentation overlay | Short copy/share confirmations, quiet cancellation, branded QR dialog with focus containment/restoration and larger controls |
| Invite/finalize dialogs duplicated through responsive actionSlot | One gated dialog mount per split page, preserving existing callbacks and access rules |
| Browser theme-color could conflict during hydration | Theme script owns one meta tag, reflecting saved theme without head-manager duplication |

## Verification completed

- Production build and TypeScript check passed after the final code changes.
- Diff whitespace check passed. The repo has no separate configured lint/test scripts.
- Landing layouts at 320, 360, 390, 430, and 768px: no horizontal overflow.
- Bill navigation at 320–1440px: 44px-high links and no horizontal overflow.
- Disposable sample bill: review, split, invite, summary, and finalize-dialog
  navigation exercised. No actual finalization or external message was sent.
- Clipboard copy confirmation passed. Native sharing success and cancellation
  were mocked to verify UI state transitions without sending messages.
- QR presentation: keyboard focus stays inside, Escape closes it, focus returns
  to the presentation button. Portrait and short landscape rendering inspected.
- Loading and receipt-reading components rendered directly: normal scan motion
  runs; reduced-motion mode disables both scan and loading loops.
- Production preview: no development tools; manual dark theme and browser chrome
  persist through reload and route navigation; no runtime errors in checked flows.
- All production asset URLs returned 200. PNG dimensions, ICO size entries,
  manifest paths, and 1200×630 social output verified.
- Separate standards and scope reviews completed; the reduced-motion finding
  was fixed. The subsequent single-dialog fix was reviewed as well.

## Checks after deployment

Actual iOS/Android home-screen appearance and live WhatsApp/Reddit crawler
previews remain device/service checks after deployment. Browser emulation
does not establish those results. This branding pass does not close unrelated
launch readiness gates in `launch-plan.md`.

Technical reference: [MDN app icon guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)
explains separate favicon/app assets, size variants, and maskable safe zones.
