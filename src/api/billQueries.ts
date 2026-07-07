import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

// Read option factories (live over WebSocket via the Convex adapter). A read is
// a single getBill / getBillByToken — the backend assembles { ...bill, claims }
// from the bill document plus its claim rows (convex/schema.ts header).
export const billQueries = {
  detail: (id: Id<'bills'>) => convexQuery(api.bills.queries.getBill, { id }),
  byToken: (shareToken: string) =>
    convexQuery(api.bills.queries.getBillByToken, { shareToken }),
}
