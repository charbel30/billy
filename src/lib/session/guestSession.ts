// v2 uses fresh random credentials. Never reuse credentials exposed by older responses.
const guestSessionKey = (shareToken: string) => `bill-guest:v2:${shareToken}`

export function getOrCreateGuestSessionId(shareToken: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const key = guestSessionKey(shareToken)
    const existing = window.localStorage.getItem(key)
    if (existing?.startsWith('v2:') && existing.length >= 20) return existing
    const created = `v2:${crypto.randomUUID()}`
    window.localStorage.setItem(key, created)
    return window.localStorage.getItem(key) === created ? created : null
  } catch {
    // Joining stays disabled with an actionable message; the public bill still works.
    return null
  }
}
