import { useSyncExternalStore } from 'react'
import { hasHostToken } from '~/lib/session'

const subscribe = () => () => undefined

/**
 * Browser-storage-backed host access, exposed without causing an SSR hydration
 * mismatch. Host tokens are written before navigation and do not change while
 * a bill screen is mounted, so this store intentionally needs no listener.
 */
export function useHasHostToken(billId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasHostToken(billId),
    () => false,
  )
}
