import { PERSON_COLORS } from './constants'

export function newClientId(): string {
  return crypto.randomUUID()
}

// 64 hex chars from two v4 UUIDs = 244 bits of CSPRNG entropy
// (crypto.randomUUID is CSPRNG-backed in both the browser and Convex's runtime).
// Far past guessing, and short enough to sit in a URL or localStorage.
function randomToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '')
  )
}

export function newShareToken(): string {
  // Unguessable, expirable/revocable (spec §10) — handed to guests via the link.
  return randomToken()
}

// The host's bearer capability for a bill (convex/schema.ts, bills.hostToken).
// Only ever called from createBill/createDemoBill on the SERVER: minting it
// server-side means a client can never choose its own host token, so an
// attacker can't pre-seed a value they know and then claim a victim's bill.
// Kept apart from newShareToken so the two can never be conflated or reused.
export function newHostToken(): string {
  return randomToken()
}

export function nextPersonColor(index: number): string {
  return PERSON_COLORS[index % PERSON_COLORS.length]
}
