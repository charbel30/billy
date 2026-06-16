import { PERSON_COLORS } from './constants'

export function newClientId(): string {
  return crypto.randomUUID()
}

export function newShareToken(): string {
  // Unguessable, expirable/revocable (spec §10). Two UUIDs of entropy.
  return (
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '')
  )
}

export function nextPersonColor(index: number): string {
  return PERSON_COLORS[index % PERSON_COLORS.length]
}
