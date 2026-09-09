import { useSyncExternalStore } from 'react'
import { hasHostToken } from '~/lib/session'

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener('focus', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('focus', onChange)
  }
}

/** Recheck on cross-tab storage changes and return to the browser. SSR holds no credential. */
export function useHasHostToken(billId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasHostToken(billId),
    () => false,
  )
}
