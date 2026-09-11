import { computePortfolios } from '~/lib/money'
import type { Claim, LineItem, Person, ServiceSplitMode } from '~/lib/types'

export interface SettlementProgress {
  settled: number
  total: number
  outstandingLbp: number
  outstandingUsd: number
}

/** How much of the table has been marked paid. People with a $0 share don't count. */
export function settlementProgress(bill: {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  tipPercent?: number | null
  rate?: number | null
}): SettlementProgress {
  const paidAt = new Map(bill.people.map((p) => [p.id, p.paidAt]))
  const payable = computePortfolios({ ...bill, rate: bill.rate ?? null }).filter(
    (p) => p.totalLbp > 0,
  )
  let settled = 0
  let outstandingLbp = 0
  let outstandingUsd = 0
  for (const p of payable) {
    if (paidAt.get(p.personId) != null) {
      settled += 1
    } else {
      outstandingLbp += p.totalLbp
      outstandingUsd += p.totalUsd
    }
  }
  return {
    settled,
    total: payable.length,
    outstandingLbp,
    outstandingUsd,
  }
}
