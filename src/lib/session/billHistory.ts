// A local, client-side history of the bills you've worked on. Powers the
// landing page's recent bills list. Stored in
// localStorage only — no server round-trip.
export type BillStep = 'review' | 'split' | 'summary'

export interface BillHistoryEntry {
  billId: string
  step: BillStep
  name?: string
  at: number
}

const KEY = 'billy:bill-history'
const MAX = 12

function isStep(v: unknown): v is BillStep {
  return v === 'review' || v === 'split' || v === 'summary'
}

function read(): BillHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is BillHistoryEntry =>
        e &&
        typeof e.billId === 'string' &&
        isStep(e.step) &&
        typeof e.at === 'number',
    )
  } catch {
    return []
  }
}

function write(list: BillHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

/** Upsert a bill to the front of the history, preserving a known name. */
export function recordBill(entry: {
  billId: string
  step: BillStep
  name?: string
}): void {
  if (typeof window === 'undefined') return
  const list = read()
  const existing = list.find((e) => e.billId === entry.billId)
  const name = entry.name?.trim() || existing?.name
  const next: BillHistoryEntry[] = [
    { billId: entry.billId, step: entry.step, name, at: Date.now() },
    ...list.filter((e) => e.billId !== entry.billId),
  ].slice(0, MAX)
  write(next)
}

export function getBillHistory(): BillHistoryEntry[] {
  return read()
}

export function getLastBill(): BillHistoryEntry | null {
  return read()[0] ?? null
}

export function clearBillHistory(): void {
  write([])
}
