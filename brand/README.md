# Spolio identity

Spolio is the bill splitter for the Lebanese table. Its visual identity pairs
a smiling receipt character with custom, rounded lowercase lettering. This is the
approved combination of concept 03’s character and concept 02’s lettering.

## Identity rules

- Use the receipt character from `src/lib/ui/brand.ts`. Keep its gentle lean,
  three rounded paper tips, and transparent facial cutouts intact. Do not stretch it.
- Use `Brand` for interface lockups and `BrandSymbol` for decorative symbols.
  The home link needs the accessible name “Spolio — home”.
- Keep clear space of at least one quarter of the symbol's width around an
  isolated mark. The app tile and favicon use their own size-specific padding.
- The symbol uses one high-contrast color. The eyes and smile are transparent,
  so the same geometry works on light, dark, and gold backgrounds.
- The wordmark is custom vector geometry, including its curved p and open final o.
  It needs no installed or embedded font. Figtree carries headings and interface copy. Cascadia Mono
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
- Loading: the receipt gently lifts and fades while a query is pending.
- Sharing: one brief icon/label confirmation after success; cancellation is quiet.
- Totals: keep existing short value transitions; reduced motion shows exact
  values immediately. The interactive landing demo uses a brief opacity change.
- Respect reduced motion. Never delay an action for an animation, invent a
  progress percentage, or loop decorative motion while the app is idle.

## Asset sources and regeneration

`src/lib/ui/brand.ts` is the canonical symbol, lettering, and core color source.
`social-card.html` is the editable 1200×630 social composition. The exporter
embeds the installed Figtree font for copy and the vector lockup when rendering it. `app-icon.svg`
and the SVGs in `public/` are generated from the canonical geometry.

With Node 24+, dependencies installed, and Chromium available:

```sh
node scripts/export-brand-assets.mjs /path/to/chromium
```

The package-script equivalent is `pnpm brand:export /path/to/chromium`.
Open `review.html` for the visual board, or `preview.png` for a static overview.

The script writes:

- `public/brand-mark.svg` and `brand-mark-light.svg` (single-color symbols).
- `public/brand-wordmark.svg` and `brand-wordmark-light.svg` (path-only vector lockups;
  no font dependency).
- SVG, ICO, and 16/32px PNG favicons; the ICO also contains a 48px image.
- 180px Apple touch icon and 192/512px Android icons.
- A 512px maskable icon with an opaque gold background and safe center mark.
- `public/og-image.png` for public and guest-link previews.
- `brand/spolio-logo/`: black and white SVG/transparent PNG lockups at 1600px
  wide, plus standalone symbols at 1024px. Monochrome colors: `#171717` and `#FFFFFF`.
- `brand/preview.png`: rendered asset review board.

`brand/spolio-logo.zip` packages the logo kit and production icons. Rebuild it
after exporting assets with:

```sh
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
with ZipFile("brand/spolio-logo.zip", "w", ZIP_DEFLATED) as archive:
    for path in sorted(Path("brand/spolio-logo").glob("*")):
        archive.write(path, "spolio-logo/" + path.name)
    for path in [Path("brand/README.md"), Path("brand/preview.png"), Path("brand/app-icon.svg")]:
        archive.write(path, "spolio-logo/" + path.name)
    for name in ["favicon.svg", "favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png", "maskable-icon-512x512.png", "brand-wordmark.svg", "brand-wordmark-light.svg", "og-image.png"]:
        archive.write(Path("public") / name, "spolio-logo/app/" + name)
PY
```

Figtree is licensed under the SIL Open Font License; its license is provided
by `@fontsource-variable/figtree/LICENSE`. Core runtime assets add no dependency.

When changing assets after release, update the `spolio-receipt-1` version in
metadata and manifest URLs to help clients request the new files. Existing
installed home-screen icons and social crawler caches can require a refresh.
