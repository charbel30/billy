import { useState } from 'react'
import { CurrencyToggle, type Currency } from '~/components/CurrencyToggle'
import { AnimatedAmount } from '~/components/bill/AnimatedAmount'
import { PortfolioReceipt } from '~/components/bill/PortfolioReceipt'
import { computePortfolios, personClaimedLines } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import type { Claim, LineItem, Person, ServiceSplitMode } from '~/lib/types'
import { cn } from '~/lib/utils'

export interface BillSummaryBill {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  rate?: number | null
}

export function BillSummary({
  bill,
  title = 'Totals',
  description,
  className,
}: {
  bill: BillSummaryBill
  title?: string
  description?: string
  className?: string
}) {
  const [currency, setCurrency] = useState<Currency>('USD')
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

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {!bill.rate && (
        <p className="text-sm text-amber-600">
          No rate set — USD shows as $0.00. Add the venue rate on the review
          screen.
        </p>
      )}

      <div className="space-y-3">
        {portfolios.map((p) => (
          <PortfolioReceipt
            key={p.personId}
            portfolio={p}
            lines={personClaimedLines(p.personId, bill.lineItems, bill.claims)}
            rate={bill.rate}
            currency={currency}
            serviceChargeOn={bill.serviceChargeOn}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <span className="text-muted-foreground">Grand total</span>
        <AnimatedAmount
          value={currency === 'LBP' ? grandLbp : toUsd(grandLbp, bill.rate)}
          format={currency === 'LBP' ? formatLbp : formatUsd}
          className="text-lg font-black"
        />
      </div>
    </section>
  )
}
