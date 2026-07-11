// How item prices render across the split/join screens: both currencies (USD
// primary + discrete LBP micro-line), USD only, or LBP only. Cycled from the
// rate pill; a module-level store so the pill and every ItemPrice stay in sync
// without prop-drilling. Persisted to localStorage, no server round-trip.
export type CurrencyDisplay = 'both' | 'usd' | 'lbp'

export const CURRENCY_DISPLAYS: readonly CurrencyDisplay[] = ['both', 'usd', 'lbp']

const KEY = 'billy:currency-display'

export function nextCurrencyDisplay(d: CurrencyDisplay): CurrencyDisplay {
  const i = CURRENCY_DISPLAYS.indexOf(d)
  return CURRENCY_DISPLAYS[(i + 1) % CURRENCY_DISPLAYS.length]
}

function isCurrencyDisplay(v: unknown): v is CurrencyDisplay {
  return v === 'both' || v === 'usd' || v === 'lbp'
}

let current: CurrencyDisplay = 'both'
const listeners = new Set<() => void>()

export function getCurrencyDisplay(): CurrencyDisplay {
  return current
}

export function subscribeCurrencyDisplay(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function setCurrencyDisplay(next: CurrencyDisplay): void {
  if (next === current) return
  current = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      // ignore quota / privacy-mode failures
    }
  }
  listeners.forEach((cb) => cb())
}

/** Read the stored preference once (deferred to mount, keeps SSR consistent). */
export function initCurrencyDisplayFromStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(KEY)
    if (isCurrencyDisplay(raw) && raw !== current) {
      current = raw
      listeners.forEach((cb) => cb())
    }
  } catch {
    // ignore
  }
}
