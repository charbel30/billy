import { ConvexError } from 'convex/values'
import type { Claim, LineItem } from '../schema'
import { saveClaimsForPerson } from './bills'

/** Apply a tap to the transaction's current claims, never a rendered snapshot. */
export function stepPersonClaim(
  lineItems: LineItem[],
  currentClaims: Claim[],
  personId: string,
  itemId: string,
  delta: number,
) {
  if (delta !== 1 && delta !== -1) throw new ConvexError('Choose add or remove one')
  if (!lineItems.some((item) => item.id === itemId)) throw new ConvexError('Item no longer exists')
  const ownClaims = currentClaims.filter((c) => c.personId === personId)
  const current = ownClaims.find((c) => c.itemId === itemId)?.units ?? 0
  const units = Math.max(0, current + delta)
  const requested = ownClaims.filter((c) => c.itemId !== itemId)
  if (units > 0) requested.push({ itemId, personId, units })
  return saveClaimsForPerson(lineItems, currentClaims, personId, requested)
}
