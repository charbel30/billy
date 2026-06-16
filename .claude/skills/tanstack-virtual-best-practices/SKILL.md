---
name: tanstack-virtual-best-practices
description: TanStack Virtual (@tanstack/react-virtual v3) best practices for virtualizing large lists, grids, and tables. Activate when rendering long photo grids, admin tables, or any scrollable list with hundreds+ of items.
---

# TanStack Virtual Best Practices

Headless virtualization for large element lists. Renders only the items visible in the
viewport (+ overscan), keeping the DOM node count constant regardless of dataset size.
`@tanstack/react-virtual` is framework-agnostic core + a thin React adapter; it ships no
markup or styles — you own the DOM and CSS, it owns the math.

## When to Apply

- A scroll container renders **hundreds+ of DOM nodes** (photo grids, admin tables,
  subscriber/event lists) and paint/scroll cost is measurable.
- The list is a **plain scroll container** — `overflow:auto` or window scroll.
- Item count is dynamic/unbounded and you don't want a hard cap.

## When NOT to Apply (project-specific)

- **GSAP-coupled lists.** Anything whose nodes are read by `getBoundingClientRect()` for
  Flip, collected via `querySelectorAll` into a ref bucket, or pinned by ScrollTrigger.
  Virtualization unmounts off-screen nodes — Flip/ScrollTrigger then operate on missing
  elements. The landing gallery (`features/gallery`) is this case: rows + previews are
  Flip-driven and the grid is capped at `MAX_GRID_THUMBS`, so it is **not** a target.
- **Justified / masonry-by-aspect-ratio layouts** where each item's size is computed from
  its neighbors (flex-grow justified rows). Virtual needs to know each item's main-axis
  size up front (or measure it in isolation). A justified row's heights only resolve once
  the whole row lays out — incompatible without precomputing the layout yourself.
- Short, bounded lists (a single upload batch capped at `MAX_FILES_PER_BATCH`). The
  virtualizer overhead isn't worth it under a few dozen nodes.

If the list is both large AND animation-coupled, decouple first (split the animated hero
strip from the long virtualized tail), don't virtualize the animated part.

## Core API (v3)

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 300, // px along the scroll axis; estimate if measuring
  overscan: 6, // extra items rendered each side of viewport
});
```

```tsx
// Scroll container — must have a fixed size + overflow
<div ref={parentRef} style={{ height: "100dvh", overflow: "auto" }}>
  {/* Spacer sized to the full virtual height */}
  <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
    {virtualizer.getVirtualItems().map((vItem) => (
      <div
        key={vItem.key}
        data-index={vItem.index}
        ref={virtualizer.measureElement} // omit if sizes are fixed
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${vItem.start}px)`,
        }}
      >
        {renderRow(items[vItem.index])}
      </div>
    ))}
  </div>
</div>
```

## Rules

### Setup (Prefix: `vt-`)

- `vt-fixed-scroll-size` — The scroll element MUST have a deterministic size (`height` +
  `overflow:auto`, or use `useWindowVirtualizer` for page scroll). Without a measurable
  rect the virtualizer renders nothing or everything.
- `vt-spacer-and-transform` — Render one inner spacer at `getTotalSize()` and absolutely
  position each virtual item at `translateY(vItem.start)`. Don't use `top` for the offset
  on the hot path — `transform` stays on the compositor (matches the repo's scroll-perf
  rules).
- `vt-estimate-close` — `estimateSize` should be near the real size; a wildly-off estimate
  causes scrollbar jump as items measure in. For fixed-size rows, return the exact size and
  skip `measureElement`.
- `vt-overscan-small` — Keep `overscan` small (4–8). Large overscan defeats the purpose by
  re-introducing nodes.

### Dynamic measurement (Prefix: `vm-`)

- `vm-measure-element` — For variable-height rows (image rows at natural aspect), attach
  `ref={virtualizer.measureElement}` AND `data-index={vItem.index}` to the measured node.
  The `data-index` is required — `measureElement` reads it to map the node back to its index.
- `vm-no-transition-on-measured` — Don't put CSS `transition` on the measured node's size
  properties; it makes the ResizeObserver chase a moving target.

### Grid / columns (Prefix: `vg-`)

- `vg-lanes-for-fixed-columns` — For a **fixed column count** grid, virtualize the rows and
  set `lanes: columnCount`, or compute `Math.floor(index / columnsPerRow)` to map a flat
  index to a row. Each virtual "row" then renders `columnsPerRow` cells.
- `vg-recompute-on-resize` — Columns-per-row is viewport-dependent; recompute it (e.g. via
  a resize observer / breakpoint) and feed it into `count`/`estimateSize` so the layout
  reflows. Pair with `virtualizer.measure()` after the column count changes.
- `vg-not-for-justified` — Do NOT use lanes for justified/aspect-ratio layouts (see "When
  NOT to Apply").

### SSR + TanStack Start (Prefix: `vs-`)

- `vs-ssr-no-window` — `getScrollElement` returns `null` on the server; the virtualizer
  renders 0 items during SSR and hydrates on mount. That's expected. If you need above-the-
  fold content server-rendered, pass `initialRect`/`initialOffset` or render a small static
  first screen and hand off to the virtualizer after mount.
- `vs-react-compiler-safe` — This repo runs the React Compiler. `useVirtualizer` returns a
  stable instance; read `getVirtualItems()` during render (not in an effect). Don't memoize
  the virtualizer's outputs manually — let the compiler handle it.

### Lenis + GSAP coexistence (Prefix: `vl-`)

- `vl-data-lenis-prevent` — A virtualized inner scroller inside a Lenis page must carry
  `data-lenis-prevent` (or use `useWindowVirtualizer` and let Lenis own the scroll). The
  existing preview grid already uses `data-lenis-prevent` — follow that pattern.
- `vl-no-scrolltrigger-on-virtual-children` — Never attach ScrollTrigger to virtualized
  children; they unmount. Drive entrance animation with CSS or a one-shot on
  `getVirtualItems()` indices instead.

### Images (Prefix: `vi-`)

- `vi-thumbhash-placeholder` — Keep the `thumbhash` data-URL background on each cell so a
  blurred placeholder shows before the real image loads (cells now mount/unmount on scroll,
  so first paint of a freshly-scrolled-in cell is more visible).
- `vi-cdn-sized` — Continue requesting `cdnImage(key, { width })` at the rendered size;
  virtualization reduces node count but not per-image bytes.
- `vi-keep-lazy` — `loading="lazy"` is still correct; it complements virtualization for the
  overscan band.

## Integration checklist

1. Add `@tanstack/react-virtual` to the workspace catalog (`pnpm-workspace.yaml`) and the
   consuming package's `package.json` as `"catalog:"` — never pin per-package.
2. Confirm the target is a plain scroll container, NOT GSAP-Flip / ScrollTrigger-coupled.
3. Give the scroll element a fixed size; render the spacer + absolute items.
4. Variable heights → `measureElement` + `data-index`. Fixed → exact `estimateSize`.
5. Inner scroller under Lenis → `data-lenis-prevent`.
6. Keep thumbhash placeholders + `cdnImage` sizing + `loading="lazy"`.
7. `pnpm lint` (type-aware) is the validation loop.

## Reference

Docs (context7 `/tanstack/virtual`): https://tanstack.com/virtual/latest
Key exports: `useVirtualizer`, `useWindowVirtualizer`. Key instance methods:
`getVirtualItems()`, `getTotalSize()`, `measureElement`, `measure()`, `scrollToIndex()`.
