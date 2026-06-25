// Remembers the bill you were last working on (and which step), so the scan
// page can offer a "resume" shortcut back into it. Stored client-side only.
export type BillStep = 'review' | 'split' | 'summary'

export interface LastBill {
  billId: string
  step: BillStep
}

const KEY = 'billy:last-bill'

export function setLastBill(value: LastBill): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function getLastBill(): LastBill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LastBill>
    if (
      parsed &&
      typeof parsed.billId === 'string' &&
      (parsed.step === 'review' ||
        parsed.step === 'split' ||
        parsed.step === 'summary')
    ) {
      return { billId: parsed.billId, step: parsed.step }
    }
  } catch {
    // ignore malformed values
  }
  return null
}
