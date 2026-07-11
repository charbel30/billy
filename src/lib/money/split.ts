// Split logic — unit-by-unit claiming (architecture-decision.md, ui-flow-vision.md).
// Each line item has `qty` units; people claim a fractional number of those units
// via `claims`. A person's share of a line = claimedUnits × effectiveUnitPrice,
// where effectiveUnitPrice = lineTotal / qty (lineTotal is the source of truth, so
// per-person totals always reconcile to the printed bill even when qty × unitPrice
// disagrees). Service/tax are distributed proportionally by default, or evenly, and
// only when serviceChargeOn. Per-person totals are COMPUTED here, never stored.
// Pure — no React/Convex imports.

import type { Claim, LineItem, Person, ServiceSplitMode } from '../types'
import { toUsd } from './currency'

export interface Portfolio {
  personId: string
  name: string
  color: string
  subtotalLbp: number
  serviceShareLbp: number
  tipShareLbp: number
  totalLbp: number
  totalUsd: number
}

export interface ComputePortfoliosInput {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  // Tip on top of the bill, percent of the CLAIMED subtotal. Absent/0 → no tip.
  // Always split proportionally (does not follow serviceSplitMode) and never
  // part of the reconcile checksum.
  tipPercent?: number | null
  rate: number | null | undefined
}

/** effectiveUnitPrice = lineTotal / qty. Falls back to unitPrice when qty is 0,
 *  so a malformed line never divides by zero. */
export function effectiveUnitPrice(item: LineItem): number {
  if (item.qty > 0) return item.lineTotal / item.qty
  return item.unitPrice
}

/** Total units of `item` claimed by anyone. */
export function claimedUnits(item: LineItem, claims: Claim[]): number {
  let sum = 0
  for (const c of claims) if (c.itemId === item.id) sum += c.units
  return sum
}

/** Units of `item` still on the bill (unclaimed). Leftover is normal, not an
 *  error — it just means counting stopped or the line was comped. */
export function remainingUnits(item: LineItem, claims: Claim[]): number {
  return Math.max(0, item.qty - claimedUnits(item, claims))
}

/** LBP value still unclaimed across the whole bill — drives the
 *  "remaining on the bill" running total / bar while splitting. */
export function totalRemainingLbp(lineItems: LineItem[], claims: Claim[]): number {
  let sum = 0
  for (const item of lineItems) {
    sum += remainingUnits(item, claims) * effectiveUnitPrice(item)
  }
  return sum
}

export interface ClaimedLine {
  itemId: string
  name: string
  units: number
  lbp: number
}

/** The lines a person claimed, with their LBP share of each — drives the
 *  per-person "little receipt" on the summary / share screen. */
export function personClaimedLines(
  personId: string,
  lineItems: LineItem[],
  claims: Claim[],
): ClaimedLine[] {
  const itemById = new Map(lineItems.map((li) => [li.id, li]))
  const lines: ClaimedLine[] = []
  for (const c of claims) {
    if (c.personId !== personId || c.units <= 0) continue
    const li = itemById.get(c.itemId)
    if (!li) continue
    lines.push({
      itemId: c.itemId,
      name: li.name,
      units: c.units,
      lbp: c.units * effectiveUnitPrice(li),
    })
  }
  return lines
}

/** Round `values` to integers summing exactly to `target` (largest-remainder).
 *  Keeps per-person totals from drifting a few LL off the bill total. */
function roundToTarget(values: number[], target: number): number[] {
  const floored = values.map((v) => Math.floor(v))
  const result = [...floored]
  let remainder = Math.round(target - floored.reduce((s, v) => s + v, 0))

  const byFrac = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)

  for (let k = 0; remainder > 0 && k < byFrac.length; k++, remainder--) {
    result[byFrac[k].i] += 1
  }
  return result
}

export function computePortfolios(input: ComputePortfoliosInput): Portfolio[] {
  const {
    lineItems,
    people,
    claims,
    serviceCharge,
    tax,
    serviceChargeOn,
    serviceSplitMode,
    tipPercent,
    rate,
  } = input

  const itemById = new Map(lineItems.map((li) => [li.id, li]))

  // Per-person raw subtotal = Σ (units × effectiveUnitPrice) over their claims.
  const subtotal = new Map<string, number>(people.map((p) => [p.id, 0]))
  for (const c of claims) {
    const li = itemById.get(c.itemId)
    if (!li || !subtotal.has(c.personId)) continue
    subtotal.set(
      c.personId,
      (subtotal.get(c.personId) ?? 0) + c.units * effectiveUnitPrice(li),
    )
  }

  const totalSubtotal = [...subtotal.values()].reduce((s, v) => s + v, 0)
  const extras = serviceChargeOn ? (serviceCharge || 0) + (tax || 0) : 0

  // Distribute service/tax: even per head, or proportional to subtotal.
  const serviceShare = new Map<string, number>()
  for (const p of people) {
    if (serviceSplitMode === 'even') {
      serviceShare.set(p.id, people.length ? extras / people.length : 0)
    } else {
      const sub = subtotal.get(p.id) ?? 0
      serviceShare.set(p.id, totalSubtotal > 0 ? extras * (sub / totalSubtotal) : 0)
    }
  }

  // Tip: always proportional to subtotal, with its own largest-remainder pass
  // so per-person tip lines sum exactly to the bill's tip.
  const pct = tipPercent ?? 0
  const tipTotal = pct > 0 ? Math.round(totalSubtotal * (pct / 100)) : 0
  const tipRaw = people.map((p) =>
    totalSubtotal > 0
      ? tipTotal * ((subtotal.get(p.id) ?? 0) / totalSubtotal)
      : 0,
  )
  const tipRounded = roundToTarget(tipRaw, tipTotal)

  // Round per-person totals so they sum exactly to the claimed grand total.
  const rawTotals = people.map(
    (p, i) => (subtotal.get(p.id) ?? 0) + (serviceShare.get(p.id) ?? 0) + tipRaw[i],
  )
  const target = totalSubtotal + extras + tipTotal
  const roundedTotals = roundToTarget(rawTotals, target)

  return people.map((p, i) => {
    const totalLbp = roundedTotals[i]
    const sub = Math.round(subtotal.get(p.id) ?? 0)
    const tipShareLbp = tipRounded[i]
    return {
      personId: p.id,
      name: p.name,
      color: p.color,
      subtotalLbp: sub,
      // Keep service = total - subtotal - tip so the row stays internally consistent.
      serviceShareLbp: totalLbp - sub - tipShareLbp,
      tipShareLbp,
      totalLbp,
      totalUsd: toUsd(totalLbp, rate),
    }
  })
}
