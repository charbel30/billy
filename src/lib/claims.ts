import type { Claim } from '~/lib/types'

/** One person's claims in the wire shape the save-claims mutations accept. */
export function claimsForPerson(claims: Claim[], personId: string) {
  return claims
    .filter((c) => c.personId === personId && c.units > 0)
    .map((c) => ({ itemId: c.itemId, units: c.units }))
}

/** Units `personId` currently holds on `itemId` (0 when unclaimed). */
export function unitsFor(
  claims: Claim[],
  itemId: string,
  personId: string,
): number {
  return (
    claims.find((c) => c.itemId === itemId && c.personId === personId)?.units ??
    0
  )
}
