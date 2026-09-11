import type { QueryClient } from '@tanstack/react-query'
import { getHostToken } from '~/lib/session'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

// Read option factories (live over WebSocket via the Convex adapter). A read is
// a single getBill / getBillByToken — the backend assembles { ...bill, claims }
// from the bill document plus its claim rows (convex/schema.ts header).
export const billQueries = {
  controlledPeople: (shareToken: string, guestSessionId: string | null) =>
    convexQuery(
      api.bills.guest.queries.getControlledPeople,
      guestSessionId ? { shareToken, guestSessionId } : 'skip',
    ),
  detail: (id: Id<'bills'>) =>
    convexQuery(api.bills.host.queries.getBill, {
      id,
      hostToken: getHostToken(id),
    }),
  byToken: (shareToken: string) =>
    convexQuery(api.bills.guest.queries.getBillByToken, { shareToken }),
}

/**
 * Prefetch the host bill for a route loader. Host routes render a public
 * shell during SSR (`HostAccessBoundary` is ClientOnly) and `getBill` needs
 * the device's hostToken, so this is a no-op until we're in the browser
 * with a stored capability.
 */
export async function ensureHostBill(
  queryClient: QueryClient,
  billId: Id<'bills'>,
) {
  if (typeof window === 'undefined' || !getHostToken(billId)) return null
  return queryClient.ensureQueryData(billQueries.detail(billId))
}
