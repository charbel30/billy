import { ConvexError } from 'convex/values'

/** Friendly message for scan failures — surfaces ConvexError data (rate
 *  limits, kill switch) which is written to be shown to users as-is. */
export function scanErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError && typeof err.data === 'string')
    return err.data
  if (err instanceof Error && err.message) return err.message
  return fallback
}
