// WhatsApp-ready text summary of a split — one tap to paste per-person totals
// into the group chat. Pure formatting over computePortfolios; no React/Convex.

import { computePortfolios } from './split'
import { formatLbp, formatUsd } from './currency'
import type { Claim, LineItem, Person, ServiceSplitMode } from './types'

export interface TotalsMessageBill {
  merchantName: string
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  rate?: number | null
}

/** SSR-safe guest link for a share token. */
export function joinUrl(shareToken: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/join/${shareToken}`
}

export function buildTotalsMessage(
  bill: TotalsMessageBill,
  joinUrl?: string | null,
): string {
  const portfolios = computePortfolios({
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    rate: bill.rate,
  })
  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const grandUsd = portfolios.reduce((s, p) => s + p.totalUsd, 0)

  const lines: string[] = [
    `🧾 ${bill.merchantName.trim() || 'Bill split'} — split with Billy`,
    '',
  ]
  for (const p of portfolios) {
    if (p.totalLbp <= 0) continue
    lines.push(`• ${p.name}: ${formatUsd(p.totalUsd)} / ${formatLbp(p.totalLbp)}`)
  }
  lines.push('', `Total: ${formatUsd(grandUsd)} / ${formatLbp(grandLbp)}`)
  if (joinUrl) lines.push('', `Claim your items: ${joinUrl}`)
  return lines.join('\n')
}
