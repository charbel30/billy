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
    people: w.people.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      ...(p.guestSessionId != null ? { guestSessionId: p.guestSessionId } : {}),
    })),
    claims: w.claims.map((c) => ({
      itemId: c.itemId,
      personId: c.personId,
      units: c.units,
    })),
  }
}

export function canPersistWorkingBill(w: WorkingBill): boolean {
  const itemIds = new Set<string>()
  for (const item of w.lineItems) {
    if (!item.id || itemIds.has(item.id)) return false
    itemIds.add(item.id)
    if (!item.name.trim()) return false
    if (!Number.isFinite(item.qty) || item.qty <= 0) return false
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return false
    if (!Number.isFinite(item.lineTotal) || item.lineTotal < 0) return false
    if (
      item.confidence != null &&
      (!Number.isFinite(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1)
    ) {
      return false
    }
  }

  const personIds = new Set<string>()
  for (const person of w.people) {
    if (!person.id || personIds.has(person.id)) return false
    personIds.add(person.id)
    if (!person.name.trim() || !person.color.trim()) return false
  }

  for (const claim of w.claims) {
    if (!itemIds.has(claim.itemId)) return false
    if (!personIds.has(claim.personId)) return false
    if (!Number.isFinite(claim.units) || claim.units < 0) return false
  }

  return true
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
