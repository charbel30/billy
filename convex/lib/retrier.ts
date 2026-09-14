import { ActionRetrier } from '@convex-dev/action-retrier'
import { components } from '../_generated/api'

// Retries the extraction action on transient vision-API failures (503s, network
// blips) before the user ever sees the failure banner. Kept short: a receipt is
// scanned at the table with people waiting — attempts at ~0s / 1s / 5s, then the
// run's final failure reaches onExtractionComplete. A deterministically bad
// image costs at most three Gemini calls (fractions of a cent; the rate
// limiter charges the scan once, at attachImageAndExtract). The component's
// maxFailures counts retries after the initial attempt, not total calls; its
// first delay is initialBackoffMs * base (with jitter).
export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 250,
  base: 4,
  maxFailures: 2,
})
