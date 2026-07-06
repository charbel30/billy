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
  // Claims referencing the removed item are dropped server-side: saveWorking
  // reconciles the claim rows against the flushed items (reconcileClaims below).
  return {
    ...bill,
    lineItems: bill.lineItems.filter((li) => li.id !== itemId),
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
  // The removed person's claims are dropped server-side (see reconcileClaims).
  return {
    ...bill,
    people: bill.people.filter((p) => p.id !== personId),
  }
}

/** Drop/scale claims so the bill remains internally consistent after edits.
 *  Runs server-side in saveWorking against the current claim ROWS — claim
 *  editing itself happens only through the scoped claim mutations. */
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
