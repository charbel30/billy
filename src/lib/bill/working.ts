import { metadataError, lineItemsError } from './validation'
import { MAX_PEOPLE } from './constants'
import type { Doc } from 'convex/_generated/dataModel'
import type { WorkingBill } from './types'

// The bill as the CLIENT sees it: the stored document minus `hostToken`, which
// queries strip (convex/model/bills.ts, toWireBill) because it's the host's
// write capability. Typing it away here keeps "the browser never holds the
// token on a bill object" a compile-time fact.
type WireBillDoc = Omit<Doc<'bills'>, 'hostToken'>

export function workingBillFromDoc(d: WireBillDoc): WorkingBill {
  return {
    lineItems: d.lineItems,
    people: d.people,
    version: d.version,
    status: d.status,
    meta: {
      merchantName: d.merchantName,
      branch: d.branch,
      datetime: d.datetime,
      currencyPrimary: d.currencyPrimary,
      rate: d.rate,
      rateSource: d.rateSource,
      serviceCharge: d.serviceCharge,
      tax: d.tax,
      serviceChargeOn: d.serviceChargeOn,
      serviceSplitMode: d.serviceSplitMode,
      printedTotalLbp: d.printedTotalLbp,
      printedTotalUsd: d.printedTotalUsd,
    },
  }
}

/** Strip each array element to exactly its schema fields. Guards against stale
 * localStorage or older-shaped objects reaching the strict saveWorking validator. */
export function sanitizeWorkingBill(w: WorkingBill): WorkingBill {
  return {
    ...w,
    lineItems: w.lineItems.map((li) => ({
      id: li.id,
      name: li.name,
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
      ...(li.confidence != null ? { confidence: li.confidence } : {}),
    })),
    people: w.people.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      ...(p.paidAt != null ? { paidAt: p.paidAt } : {}),
    })),
  }
}

export function canPersistWorkingBill(w: WorkingBill): boolean {
  if (metadataError(w.meta) || lineItemsError(w.lineItems)) return false
  if (w.people.length > MAX_PEOPLE) return false

  const personIds = new Set<string>()
  for (const person of w.people) {
    if (!person.id || personIds.has(person.id)) return false
    personIds.add(person.id)
    if (!person.name.trim() || !person.color.trim()) return false
  }

  return true
}

/** A stored working copy is only usable if it's the current single-doc shape. */
export function isValidWorkingBill(w: unknown): w is WorkingBill {
  const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!record(w) || !Number.isInteger(w.version) || Number(w.version) < 0)
    return false
  if (
    !['PENDING', 'NEEDS_REVIEW', 'READY', 'PUBLISHED', 'FINALIZED'].includes(
      String(w.status),
    )
  )
    return false
  if (
    !record(w.meta) ||
    !Array.isArray(w.lineItems) ||
    !Array.isArray(w.people)
  )
    return false
  const meta = w.meta
  if (
    typeof meta.merchantName !== 'string' ||
    typeof meta.currencyPrimary !== 'string' ||
    typeof meta.serviceCharge !== 'number' ||
    typeof meta.tax !== 'number' ||
    typeof meta.serviceChargeOn !== 'boolean' ||
    !['manual', 'market', 'receipt'].includes(String(meta.rateSource)) ||
    !['even', 'proportional'].includes(String(meta.serviceSplitMode))
  )
    return false
  for (const key of ['rate', 'printedTotalLbp', 'printedTotalUsd']) {
    if (meta[key] !== undefined && typeof meta[key] !== 'number') return false
  }
  return (
    w.lineItems.every(
      (item) =>
        record(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.qty === 'number' &&
        typeof item.unitPrice === 'number' &&
        typeof item.lineTotal === 'number',
    ) &&
    w.people.every(
      (person) =>
        record(person) &&
        typeof person.id === 'string' &&
        typeof person.name === 'string' &&
        typeof person.color === 'string',
    )
  )
}
