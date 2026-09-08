# Spolio identity

Spolio is the bill splitter for the Lebanese table. Its visual identity pairs
one circle, divided into two equal shares, with a clear Figtree wordmark.

## Identity rules

- Use the balanced split-circle from `src/lib/ui/brand.ts`. Keep both halves,
  their 45-degree angle, and their gap intact. Do not stretch or rotate the mark.
- Use `Brand` for interface lockups and `BrandSymbol` for decorative symbols.
  The home link needs the accessible name “Spolio — home”.
- Keep clear space of at least one quarter of the symbol's diameter around an
  isolated mark. The app tile and favicon use their own size-specific padding.
- The symbol may be ink, gold, or a single high-contrast color. Never color
  the two halves separately: people colors belong to bill participants.
- Figtree carries headings, interface copy, and the wordmark. Cascadia Mono
  carries bill amounts. The landing receipt uses a small serif heading as a
  paper detail; do not extend it to navigation or controls.

| Color | Value | Role |
| --- | --- | --- |
| Gold | `#F7C928` | Logo tile, scan and primary actions |
| Ink | `#202820` | Mark, headings, readable text on gold |
| Table green | `#285647` | Links, amounts, selected controls |
| Paper | `#F8F7F3` | Light canvas |
| Night | `#100F0C` | Dark canvas |
| Soft green | `#B5CFAC` | Readable accent in dark mode |

## Voice

Lead with the job: scan a receipt, pick what you had, share the bill in dollars
and lira. Mention Lebanon near the first action. Use familiar meal references
without decorative national symbols. English remains the interface language.

Keep state copy literal: “Reading your receipt”, “Link copied”, “All items
assigned”. A published link is not a payment. Never imply that Spolio sends or
collects money. Error copy should explain the next action.

## Motion

- Navigation: one active pill, 300ms spring, no bounce.
- Reading: a scan line moves over a stationary receipt while extraction runs.
- Loading: the two circle halves breathe apart gently while a query is pending.
- Sharing: one brief icon/label confirmation after success; cancellation is quiet.
- Totals: keep existing short value transitions; reduced motion shows exact
  values immediately. The interactive landing demo uses a brief opacity change.
- Respect reduced motion. Never delay an action for an animation, invent a
  progress percentage, or loop decorative motion while the app is idle.

## Asset sources and regeneration

`src/lib/ui/brand.ts` is the canonical symbol geometry and core color source.
`social-card.html` is the editable 1200×630 social composition. The exporter
embeds the installed Figtree font and symbol when rendering it. `app-icon.svg`
and the SVGs in `public/` are generated from the canonical geometry.

With Node 24+, dependencies installed, and Chromium available:

```sh
node scripts/export-brand-assets.mjs /path/to/chromium
```

The package-script equivalent is `pnpm brand:export /path/to/chromium`.
Open `review.html` for the visual board, or `preview.png` for a static overview.

The script writes:

- `public/brand-mark.svg` and `brand-mark-light.svg` (single-color symbols).
- `public/brand-wordmark.svg` and `brand-wordmark-light.svg` (vector lockups;
  Figtree is embedded, so no network font request is needed).
- SVG, ICO, and 16/32px PNG favicons; the ICO also contains a 48px image.
- 180px Apple touch icon and 192/512px Android icons.
- A 512px maskable icon with an opaque gold background and safe center mark.
- `public/og-image.png` for public and guest-link previews.

Figtree is licensed under the SIL Open Font License; its license is provided
by `@fontsource-variable/figtree/LICENSE`. Core runtime assets add no dependency.

When changing assets after release, update the `spolio-circle-1` version in
metadata and manifest URLs to help clients request the new files. Existing
installed home-screen icons and social crawler caches can require a refresh.
