# Receipt Splitter — UI & Flow Vision (notes)

My thoughts on how this should *feel*, not a final spec. Source of truth for product
logic stays in `receipt-splitter-build-spec.md`; this is the experience layer on top.

## Guiding feel
- It should look and read like an **actual bill**, not a generic form of inputs and outputs.
- Cleaner, rounder, more polished. Everything lives in **one well-composed card** that's
  easy to understand at a glance.
- **USD shown better** — it's a headline number, not an afterthought next to LBP.
- More **motion**: things animate as you assign, totals tick, items move. It should feel alive.

## Defaults
- **Tax / service charge OFF by default.** Not included unless the user turns it on.
  The control exists but starts off (and collapsed), so a plain bill just splits the items.

## Review screen — receipt style
- Lay the items out like a printed receipt (item name + line total down the page).
- **Editing lives on the right** of each row: unit price, qty, etc. as inline controls
  attached to that line — not a separate generic edit grid.
- Confidence / "check this" flags shown subtly inline, in the bill aesthetic.
- Rate + dual currency visible in the bill header.

## Splitting — real-time, unit by unit
The big change: **don't** "add everyone, then assign at the end." Assign as you go.

- **Always start with "self"** as the first person — the bill is yours by default.
- Pick a person, then **pull units off the receipt onto them**: it feels like taking a unit
  off the original bill and giving it to that person. Conceptually drag-and-drop, but as
  simple as: tap a person → `+1` this item, `+2` that item, `+1` this item → **Finish**.
- Units **decrement from the original receipt** as they're claimed, so you can always see
  what's left unassigned. When the receipt empties, everyone's portfolio is full.
- This is **per-unit**, not equal-fraction: an item with qty 5 can go 2 to A, 3 to B.

> Build implication: assignments become **unit counts per (item, person)** rather than an
> equal `shareFraction`. The split math changes from "divide line equally among assignees"
> to "person's share = claimed_units × unit_price". Worth reworking `assignments` +
> `split.ts` for this. Shared/odd splits (e.g. a shared dessert) can still use a fractional
> unit when needed.

## Final / share screen
- A **cool bill-style summary**: each person's portfolio rendered like their own little
  receipt, totals in LBP **and** USD, the venue rate on it.
- Shareable as-is (link/image), feels like handing someone their slice of the bill.

## Other / open
- Animations: items flying to a person, totals counting up, remaining-balance bar.
- Empty/edge states in the same bill aesthetic (nothing assigned yet, leftover units).
- Maybe a "remaining on the bill" running total while splitting.
- (Add more here as it comes.)
