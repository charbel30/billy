import type { Id } from 'convex/_generated/dataModel'
import type { WorkingBill } from './types'
import { isValidWorkingBill } from './working'

const workingStorageKey = (id: Id<'bills'>) => `bill-working:${id}`

export function persistWorkingBill(id: Id<'bills'>, w: WorkingBill): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(workingStorageKey(id), JSON.stringify(w))
    return true
  } catch {
    return false
  }
}

export function clearWorkingBill(
  id: Id<'bills'>,
  acknowledged: WorkingBill,
): void {
  if (typeof window === 'undefined') return
  try {
    if (
      window.localStorage.getItem(workingStorageKey(id)) ===
      JSON.stringify(acknowledged)
    ) {
      window.localStorage.removeItem(workingStorageKey(id))
    }
  } catch {
    // Ignore storage failures.
  }
}

export function readWorkingBill(id: Id<'bills'>): WorkingBill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(workingStorageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isValidWorkingBill(parsed)) {
      window.localStorage.removeItem(workingStorageKey(id))
      return null
    }
    return parsed
  } catch {
    return null
  }
}
