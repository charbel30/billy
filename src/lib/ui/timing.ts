// Durations shared by the scan → review → split → summary flow. Keep them here
// (not inline) so the processing screen, the route transitions and the CSS that
// mirrors them can never drift apart.

/** Never flash the processing screen: hold it at least this long once shown. */
export const PROCESSING_MIN_VISIBLE_MS = 900

/** How long a scan may run before the "enter items manually" escape hatch appears. */
export const PROCESSING_SLOW_HINT_MS = 10_000

/** Seconds between two receipt rows writing themselves in (`revealContainer`). */
const REVEAL_ROW_STAGGER_S = 0.05
const REVEAL_LEAD_IN_S = 0.1
const REVEAL_TAIL_CAP_S = 0.6

/** When the last row has landed: what the dock and the flag pulse wait for. */
export function revealTailDelay(rows: number): number {
  return Math.min(REVEAL_LEAD_IN_S + rows * REVEAL_ROW_STAGGER_S, REVEAL_TAIL_CAP_S)
}

/** Cosmetic: how long "Reading the receipt" holds before "Checking totals". */
export const PROCESSING_CHECKING_LABEL_MS = 6_000

/** Entering page of a route transition (mirrored in the view-transition CSS). */
export const ROUTE_TRANSITION_MS = 320

/** Leaving page of a route transition — exits stay shorter than enters. */
export const ROUTE_TRANSITION_EXIT_MS = 220
