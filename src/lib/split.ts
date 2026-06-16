// Split logic (spec §6.1). Each line item is assigned to one or more people; a
// shared item splits by its assignees' shareFractions. Service/tax are distributed
// proportionally to each person's subtotal by default, or evenly on request.
// Per-person totals are COMPUTED here, never stored, so they never drift.
// Pure — no React/Convex imports.

import type {
  AssignmentInput,
  LineItemInput,
  PersonInput,
  ServiceSplitMode,
} from './types'
import { toUsd } from './currency'

export interface Portfolio {
  personId: string
  name: string
  color: string
  subtotalLbp: number
  serviceShareLbp: number
  totalLbp: number
  totalUsd: number
}

export interface ComputePortfoliosInput {
  lineItems: LineItemInput[]
  people: PersonInput[]
  assignments: AssignmentInput[]
  serviceCharge: number
  tax: number
  rate: number | null | undefined
  serviceSplitMode: ServiceSplitMode
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
  const { lineItems, people, assignments, serviceCharge, tax, rate, serviceSplitMode } =
    input

  const itemById = new Map(lineItems.map((li) => [li._id, li]))

  // Per-person raw subtotal = Σ (lineTotal × shareFraction) over their assignments.
  const subtotal = new Map<string, number>(people.map((p) => [p._id, 0]))
  for (const a of assignments) {
    const li = itemById.get(a.lineItemId)
    if (!li || !subtotal.has(a.personId)) continue
    subtotal.set(a.personId, (subtotal.get(a.personId) ?? 0) + li.lineTotal * a.shareFraction)
  }

  const totalSubtotal = [...subtotal.values()].reduce((s, v) => s + v, 0)
  const extras = (serviceCharge || 0) + (tax || 0)

  // Distribute service/tax: even per head, or proportional to subtotal.
  const serviceShare = new Map<string, number>()
  for (const p of people) {
    if (serviceSplitMode === 'even') {
      serviceShare.set(p._id, people.length ? extras / people.length : 0)
    } else {
      const sub = subtotal.get(p._id) ?? 0
      serviceShare.set(p._id, totalSubtotal > 0 ? extras * (sub / totalSubtotal) : 0)
    }
  }

  // Round per-person totals so they sum exactly to the assigned grand total.
  const rawTotals = people.map(
    (p) => (subtotal.get(p._id) ?? 0) + (serviceShare.get(p._id) ?? 0),
  )
  const target = totalSubtotal + extras
  const roundedTotals = roundToTarget(rawTotals, target)

  return people.map((p, i) => {
    const totalLbp = roundedTotals[i]
    const sub = Math.round(subtotal.get(p._id) ?? 0)
    return {
      personId: p._id,
      name: p.name,
      color: p.color,
      subtotalLbp: sub,
      // Keep service = total - subtotal so the row stays internally consistent.
      serviceShareLbp: totalLbp - sub,
      totalLbp,
      totalUsd: toUsd(totalLbp, rate),
    }
  })
}
