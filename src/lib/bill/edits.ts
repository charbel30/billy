import type { Claim, LineItem, Person } from '../types'
import { newClientId, nextPersonColor } from './ids'
import type { WorkingBill, WorkingMeta } from './types'

export function updateMeta(
  bill: WorkingBill,
  patch: Partial<WorkingMeta>,
): WorkingBill {
  return { ...bill, meta: { ...bill.meta, ...patch } }
}

export function addLineItemToBill(
  bill: WorkingBill,
  item?: Partial<LineItem>,
): WorkingBill {
  return {
    ...bill,
    lineItems: [
      ...bill.lineItems,
      {
        id: newClientId(),
        name: item?.name ?? '',
        qty: item?.qty ?? 1,
        unitPrice: item?.unitPrice ?? 0,
        lineTotal:
          item?.lineTotal ?? (item?.qty ?? 1) * (item?.unitPrice ?? 0),
        confidence: item?.confidence,
      },
    ],
  }
}

export function updateLineItemInBill(
  bill: WorkingBill,
  itemId: string,
  patch: Partial<LineItem>,
): WorkingBill {
  return {
    ...bill,
    lineItems: bill.lineItems.map((li) =>
      li.id === itemId ? { ...li, ...patch } : li,
    ),
  }
}

export function removeLineItemFromBill(
  bill: WorkingBill,
  itemId: string,
): WorkingBill {
  return {
    ...bill,
    lineItems: bill.lineItems.filter((li) => li.id !== itemId),
    claims: bill.claims.filter((c) => c.itemId !== itemId),
  }
}

export function addPersonToBill(bill: WorkingBill, name: string): WorkingBill {
  return {
    ...bill,
    people: [
      ...bill.people,
      {
        id: newClientId(),
        name,
        color: nextPersonColor(bill.people.length),
      },
    ],
  }
}

export function updatePersonInBill(
  bill: WorkingBill,
  personId: string,
  patch: Partial<Person>,
): WorkingBill {
  return {
    ...bill,
    people: bill.people.map((p) =>
      p.id === personId ? { ...p, ...patch } : p,
    ),
  }
}

export function removePersonFromBill(
  bill: WorkingBill,
  personId: string,
): WorkingBill {
  return {
    ...bill,
    people: bill.people.filter((p) => p.id !== personId),
    claims: bill.claims.filter((c) => c.personId !== personId),
  }
}

export function setClaimOnBill(
  bill: WorkingBill,
  itemId: string,
  personId: string,
  units: number,
): WorkingBill {
  const item = bill.lineItems.find((li) => li.id === itemId)
  const max = item ? item.qty : units
  const clampedUnits = Math.max(0, Math.min(units, max))
  const rest = bill.claims.filter(
    (c) => !(c.itemId === itemId && c.personId === personId),
  )

  return {
    ...bill,
    claims:
      clampedUnits > 0
        ? [...rest, { itemId, personId, units: clampedUnits }]
        : rest,
  }
}

export function stepClaimOnBill(
  bill: WorkingBill,
  itemId: string,
  personId: string,
  delta: number,
): WorkingBill {
  const current = bill.claims.find(
    (c) => c.itemId === itemId && c.personId === personId,
  )
  return setClaimOnBill(
    bill,
    itemId,
    personId,
    (current?.units ?? 0) + delta,
  )
}

export function shareItemEvenly(
  bill: WorkingBill,
  itemId: string,
  personIds: string[],
): WorkingBill {
  const item = bill.lineItems.find((li) => li.id === itemId)
  if (!item || personIds.length === 0) return bill

  const units = item.qty / personIds.length
  const rest = bill.claims.filter((c) => c.itemId !== itemId)

  return {
    ...bill,
    claims: [
      ...rest,
      ...personIds.map((personId) => ({ itemId, personId, units })),
    ],
  }
}

/** Drop/scale claims so the bill remains internally consistent after edits. */
export function reconcileClaims(
  items: LineItem[],
  people: Person[],
  claims: Claim[],
): Claim[] {
  const itemById = new Map(items.map((i) => [i.id, i]))
  const personIds = new Set(people.map((p) => p.id))

  const live = claims.filter(
    (c) => itemById.has(c.itemId) && personIds.has(c.personId) && c.units > 0,
  )

  const claimedByItem = new Map<string, number>()
  for (const c of live) {
    claimedByItem.set(c.itemId, (claimedByItem.get(c.itemId) ?? 0) + c.units)
  }

  return live.map((c) => {
    const item = itemById.get(c.itemId)
    const claimed = claimedByItem.get(c.itemId) ?? 0
    if (item && item.qty > 0 && claimed > item.qty) {
      return { ...c, units: (c.units * item.qty) / claimed }
    }
    return c
  })
}
