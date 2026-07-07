// Guest identity on the join page: an anonymous per-(device, bill) session id
// kept in localStorage. Guest mutations are scoped to it server-side — a guest
// can only edit people stamped with their own guestSessionId.

const guestSessionKey = (shareToken: string) => `bill-guest:${shareToken}`

export function getOrCreateGuestSessionId(shareToken: string): string | null {
  if (typeof window === 'undefined') return null
  const key = guestSessionKey(shareToken)
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}
