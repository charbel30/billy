// The host's capability for a bill, kept on the host's own device.
//
// The bill id is in the URL (/review|/split|/summary/$billId) and therefore in
// browser history, screenshots and anything the host pastes — so it can't be
// what authorizes host writes. `createBill` mints a random `hostToken`
// server-side and returns it exactly once; we stash it here and send it with
// every host mutation (convex/bills/lib/functions.ts). No query ever returns
// it, so this store is the only copy outside the database.
//
// Deliberately its own localStorage key rather than a field on billHistory.ts:
// history entries are a display model that flows into React components and the
// "recent scans" list, and a bearer secret has no business riding along in one.
// Both live in localStorage on the same origin, so resume-from-history keeps
// working — the entry supplies the id, this store supplies the capability.

const KEY = 'billy:host-tokens'
// Bounded so the store can't grow forever on a shared/kiosk device. Comfortably
// above billHistory's 12 visible entries, so resume never outlives its token.
const MAX = 50

type TokenStore = Record<string, string>

function read(): TokenStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

/** Store the token minted for a freshly created bill. Call this immediately
 *  after createBill — the value is never retrievable from the server again. */
export function rememberHostToken(billId: string, hostToken: string): void {
  if (typeof window === 'undefined' || !hostToken) return
  const store = read()
  delete store[billId] // re-insert so this bill counts as the most recent key
  const entries = [...Object.entries(store), [billId, hostToken]].slice(-MAX)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

/** The host capability for this bill, or '' when this device doesn't hold it
 *  (someone else's link, a cleared browser, a second device). Empty rather than
 *  null on purpose: the request still goes out and the server answers with one
 *  consistent "no edit access on this device" error instead of the UI guessing. */
export function getHostToken(billId: string): string {
  return read()[billId] ?? ''
}

/** Whether this device can host-edit the bill. UI-level hint only — the server
 *  is the one that decides, on every single mutation. */
export function hasHostToken(billId: string): boolean {
  return getHostToken(billId) !== ''
}
