import type { Doc } from 'convex/_generated/dataModel'
import type { WorkingBill } from './types'

export function workingBillFromDoc(d: Doc<'bills'>): WorkingBill {
  return {
    lineItems: d.lineItems,
    people: d.people,
    claims: d.claims,
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
    people: w.people.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    claims: w.claims.map((c) => ({
      itemId: c.itemId,
      personId: c.personId,
      units: c.units,
    })),
  }
}

/** A stored working copy is only usable if it's the current single-doc shape. */
export function isValidWorkingBill(w: unknown): w is WorkingBill {
  if (!w || typeof w !== 'object') return false
  const o = w as Record<string, unknown>
  if (typeof o.version !== 'number') return false
  if (
    !Array.isArray(o.lineItems) ||
    !Array.isArray(o.people) ||
    !Array.isArray(o.claims)
  ) {
    return false
  }
  return (
    o.lineItems.every(
      (li) => li && typeof (li as { id?: unknown }).id === 'string',
    ) &&
    o.people.every(
      (p) => p && typeof (p as { id?: unknown }).id === 'string',
    )
  )
}
