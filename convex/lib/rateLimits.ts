import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { ConvexError } from 'convex/values'
import { components } from '../_generated/api'

// Extraction is the only paid path (one Gemini vision call per scan), and the
// scan mutations are public + unauthenticated. Two layers:
//   - per-device limits keep honest users honest (the key is a client-generated
//     device id, so a determined abuser can rotate it — that's expected);
//   - the global daily budget is the real backstop: whatever keys attackers
//     invent, total Gemini spend per day is capped.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Bill creation is free (a DB row) but gates the scan flow; generous cap.
  createBillPerDevice: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
  // The paid step. A real table scans a handful of receipts per sitting.
  extractPerDevice: { kind: 'token bucket', rate: 12, period: HOUR, capacity: 6 },
  uploadUrlPerDevice: { kind: 'token bucket', rate: 12, period: HOUR, capacity: 6 },
  // Sized to a ~$30/mo ceiling on gemini-2.5-flash-lite ($0.10/M input,
  // $0.40/M output). A 2000px receipt tiles to ~1.5k image tokens; with the
  // prompt and a JSON response that is roughly $0.0007 per call. The retrier
  // (initial attempt + 2 retries) can triple that on a persistently failing image, so budget
  // the worst case: 400/day * 3 * $0.0007 * 30d ~= $25/mo. At the old cap of
  // 1000/day the same worst case was ~$63/mo — over budget.
  extractGlobalDaily: { kind: 'fixed window', rate: 400, period: 24 * HOUR },
  // A leaked share link shouldn't allow unbounded guest spam on one bill.
  guestJoinPerBill: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 15 },
  // Guest claim writes (step / share evenly / undo), keyed `${billId}:${guestSessionId}`.
  // Each +/- tap is one mutation. A guest hammering + on a long receipt — or one
  // guest assigning the whole table — bursts maybe 5-8 taps/s for a few seconds,
  // then slows to well under 1/s while reading. A 60-tap burst plus a sustained
  // 2 taps/s covers that with headroom; a script churning the table does not.
  guestClaimPerSession: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 60 },
  // Backstop across every session at one table (key = billId). Sessions are
  // bounded by MAX_PEOPLE (30) and minted only via joinSplit (guestJoinPerBill),
  // so a few scripted sessions could otherwise multiply the per-session cap.
  // ~5 busy guests tapping at the full sustained per-session rate fit (10/s), and
  // the 200 burst absorbs a whole table claiming at once when the link lands.
  guestClaimPerBill: { kind: 'token bucket', rate: 600, period: MINUTE, capacity: 200 },
})

/** Spend emergency brake: `npx convex env set EXTRACTION_DISABLED 1`. */
export function assertExtractionEnabled() {
  if (process.env.EXTRACTION_DISABLED) {
    throw new ConvexError(
      'Scanning is temporarily paused. Please try again later or enter the bill manually.',
    )
  }
}
