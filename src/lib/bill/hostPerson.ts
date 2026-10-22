import { DEFAULT_PERSON_NAME, RESERVED_GUEST_NAMES } from './constants'

// The host's own person: seeded at bill creation (convex/bills/host/lifecycle.ts)
// with DEFAULT_PERSON_NAME and the stable `isHost: true` marker, so the host
// can rename it and still be recognised. `isHost` is never taken from a client
// payload (saveWorking derives it from the stored bill). Bills created before
// the marker existed fall back to the seed name.
//
// Shared by client and server. The wire strips guest credentials (toWireBill),
// so on the client `guestSessionId` is always absent; on the server it keeps a
// guest-minted row from ever counting as the host (hostOwnPersonId in
// convex/model/bills.ts re-checks it — that check is the authority).
type HostCandidate = {
  id: string
  name: string
  isHost?: boolean
  guestSessionId?: string
}

/** Id of the host's own person, or undefined if the bill has none. */
export function hostPersonId(people: readonly HostCandidate[]): string | undefined {
  const notGuest = (p: HostCandidate) => !p.guestSessionId
  if (people.some((p) => p.isHost === true)) {
    return people.find((p) => p.isHost === true && notGuest(p))?.id
  }
  // Legacy bills (no marker anywhere): the seed name identifies the host.
  return people.find((p) => p.name === DEFAULT_PERSON_NAME && notGuest(p))?.id
}

/** How the host's own person reads in one view: `seed` while it still carries
 * the internal seed name, `renamed(name)` once the host has named it. */
export type HostLabels = {
  seed: string
  renamed: (name: string) => string
}

export function hostDisplayName(name: string, labels: HostLabels) {
  return name === DEFAULT_PERSON_NAME ? labels.seed : labels.renamed(name)
}

/** Relabel the host's own person for a view (host: "You" / "Maya (you)";
 * guest: "Host" / "Maya (host)"). Other people pass through unchanged (same
 * objects); the input is not mutated. */
export function withHostLabel<P extends HostCandidate>(
  people: P[],
  hostId: string | undefined,
  labels: HostLabels,
): P[] {
  return people.map((p) =>
    p.id === hostId ? { ...p, name: hostDisplayName(p.name, labels) } : p,
  )
}

/** True when a guest-chosen name would read as the host (trimmed, case-insensitive). */
export function isReservedGuestName(name: string) {
  return (RESERVED_GUEST_NAMES as readonly string[]).includes(
    name.trim().toLowerCase(),
  )
}
