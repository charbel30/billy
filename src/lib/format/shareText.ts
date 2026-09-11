import { metadataError, lineItemsError } from '../bill/validation'
// WhatsApp-ready text summary of a split — one tap to paste per-person totals
// into the group chat. Pure formatting over computePortfolios; no React/Convex.

import { computePortfolios, personClaimedLines, unallocatedAmounts } from '../money/split'
import { formatLbp, formatUsd, toUsd } from '../money/currency'
import { formatUnits } from './format'
import type { Claim, LineItem, Person, ServiceSplitMode } from '../types'

export interface TotalsMessageBill {
  merchantName: string
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  tipPercent?: number | null
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
  const invalid =
    metadataError({ ...bill, currencyPrimary: 'LBP' }) ??
    lineItemsError(bill.lineItems)
  if (invalid) return `This bill needs correction before settling: ${invalid}`
  const portfolios = computePortfolios({
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    tipPercent: bill.tipPercent,
    rate: bill.rate,
  })
  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const grandUsd = portfolios.reduce((s, p) => s + p.totalUsd, 0)
  const tipLbp = portfolios.reduce((s, p) => s + p.tipShareLbp, 0)

  const lines: string[] = [
    `🧾 ${bill.merchantName.trim() || 'Bill split'} — split with Spolio`,
    '',
  ]
  const paidById = new Map(bill.people.map((p) => [p.id, p.paidAt != null]))
  for (const p of portfolios) {
    if (p.totalLbp <= 0) continue
    const paidMark = paidById.get(p.personId) ? ' ✅' : ''
    lines.push(
      `• ${p.name}: ${formatUsd(p.totalUsd)} / ${formatLbp(p.totalLbp)}${paidMark}`,
    )
  }
  const tipNote =
    tipLbp > 0 && bill.tipPercent ? ` (incl. ${bill.tipPercent}% tip)` : ''
  lines.push(
    '',
    `Total: ${formatUsd(grandUsd)} / ${formatLbp(grandLbp)}${tipNote}`,
  )
  const unallocated = unallocatedAmounts(bill)
  if (unallocated.totalLbp > 0)
    lines.push(
      `Unallocated (not included above): ${formatLbp(unallocated.totalLbp)}`,
    )
  if (joinUrl) lines.push('', `Claim your items: ${joinUrl}`)
  return lines.join('\n')
}

function formatShareUnits(n: number): string {
  if (Math.abs(n - 0.5) < 0.001) return '½'
  if (Math.abs(n - 1 / 3) < 0.02) return '⅓'
  if (Math.abs(n - 2 / 3) < 0.02) return '⅔'
  if (Math.abs(n - 0.25) < 0.001) return '¼'
  if (Math.abs(n - 0.75) < 0.001) return '¾'
  return formatUnits(n)
}

/** One person's itemized share, for the per-person Send action. */
export function buildPersonMessage(
  bill: TotalsMessageBill,
  personId: string,
  opts?: { joinUrl?: string | null; paymentNote?: string | null },
): string {
  const person = bill.people.find((p) => p.id === personId)
  const name = person?.name.trim() || 'You'
  const merchant = bill.merchantName.trim() || 'Bill'
  const portfolios = computePortfolios({
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    tipPercent: bill.tipPercent,
    rate: bill.rate,
  })
  const portfolio = portfolios.find((p) => p.personId === personId)
  const lines: string[] = [`🧾 ${merchant} — your share`]
  if (!portfolio || portfolio.totalLbp <= 0) {
    lines.push('', 'Nothing claimed on this bill.')
    if (opts?.joinUrl) lines.push('', `See the receipt: ${opts.joinUrl}`)
    return lines.join('\n')
  }

  const claimed = personClaimedLines(personId, bill.lineItems, bill.claims)
  for (const row of claimed) {
    const usd = formatUsd(toUsd(row.lbp, bill.rate))
    lines.push(
      `• ${formatShareUnits(row.units)} × ${row.name}        ${usd} / ${formatLbp(row.lbp)}`,
    )
  }
  if (portfolio.serviceShareLbp !== 0) {
    lines.push(
      `Service & tax              ${formatUsd(toUsd(portfolio.serviceShareLbp, bill.rate))} / ${formatLbp(portfolio.serviceShareLbp)}`,
    )
  }
  if (portfolio.tipShareLbp !== 0) {
    const tipLabel = bill.tipPercent ? `Tip (${bill.tipPercent}%)` : 'Tip'
    const pad = ' '.repeat(Math.max(1, 26 - tipLabel.length))
    lines.push(
      `${tipLabel}${pad}${formatUsd(toUsd(portfolio.tipShareLbp, bill.rate))} / ${formatLbp(portfolio.tipShareLbp)}`,
    )
  }
  lines.push(
    `Total: ${formatUsd(portfolio.totalUsd)} / ${formatLbp(portfolio.totalLbp)}`,
  )
  const note = opts?.paymentNote?.trim()
  if (note) lines.push(note)
  if (opts?.joinUrl) lines.push('', `See the receipt: ${opts.joinUrl}`)
  return lines.join('\n')
}
