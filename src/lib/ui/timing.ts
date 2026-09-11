// Durations shared by the scan → review → split → summary flow. Keep them here
// (not inline) so the processing screen, the route transitions and the CSS that
// mirrors them can never drift apart.

/** Never flash the processing screen: hold it at least this long once shown. */
export const PROCESSING_MIN_VISIBLE_MS = 900

/** How long a scan may run before the "enter items manually" escape hatch appears. */
export const PROCESSING_SLOW_HINT_MS = 10_000

/** Entering page of a route transition (mirrored in the view-transition CSS). */
export const ROUTE_TRANSITION_MS = 320

/** Leaving page of a route transition — exits stay shorter than enters. */
export const ROUTE_TRANSITION_EXIT_MS = 220
