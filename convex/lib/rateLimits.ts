import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'
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
  extractGlobalDaily: { kind: 'fixed window', rate: 1000, period: 24 * HOUR },
  // A leaked share link shouldn't allow unbounded guest spam on one bill.
  guestJoinPerBill: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 15 },
})

/** Spend emergency brake: `npx convex env set EXTRACTION_DISABLED 1`. */
export function assertExtractionEnabled() {
  if (process.env.EXTRACTION_DISABLED) {
    throw new ConvexError(
      'Scanning is temporarily paused. Please try again later or enter the bill manually.',
    )
  }
}
