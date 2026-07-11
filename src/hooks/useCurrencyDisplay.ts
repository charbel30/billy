import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  getCurrencyDisplay,
  initCurrencyDisplayFromStorage,
  nextCurrencyDisplay,
  setCurrencyDisplay,
  subscribeCurrencyDisplay,
  type CurrencyDisplay,
} from '~/lib/session'

// Currency-display preference shared by the rate pill and every item price.
// Backed by a module store so all consumers stay in sync; the stored value is
// read after mount (deferred) so SSR and first client paint agree on 'both'.
export function useCurrencyDisplay(): {
  display: CurrencyDisplay
  cycleDisplay: () => void
} {
  const display = useSyncExternalStore(
    subscribeCurrencyDisplay,
    getCurrencyDisplay,
    () => 'both' as CurrencyDisplay,
  )

  useEffect(() => {
    initCurrencyDisplayFromStorage()
  }, [])

  const cycleDisplay = useCallback(() => {
    setCurrencyDisplay(nextCurrencyDisplay(getCurrencyDisplay()))
  }, [])

  return { display, cycleDisplay }
}
