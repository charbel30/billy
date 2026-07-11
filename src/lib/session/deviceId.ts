const KEY = 'billy:device-id'

// Anonymous per-browser id used as the rate-limit key on scan mutations.
// Not a security boundary (an abuser can rotate it — the global daily budget
// on the backend is the real backstop); it just scopes honest users' limits.
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-no-device'
  let id = window.localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(KEY, id)
  }
  return id
}
