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

// Per-person "little receipts" plus the grand total. USD is the headline figure
// with LBP underneath (matches the redesigned review screen) — no currency toggle.
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
      <div>
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {!bill.rate && (
        <p className="rounded-3xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
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
            serviceChargeOn={bill.serviceChargeOn}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-3xl bg-muted/70 px-4 py-3 ring-1 ring-border/40">
        <span className="font-bold text-muted-foreground">Grand total</span>
        <div className="text-right">
          <AnimatedAmount
            value={toUsd(grandLbp, bill.rate)}
            format={formatUsd}
            className="block text-xl font-black tracking-tight text-primary"
          />
          <AnimatedAmount
            value={grandLbp}
            format={formatLbp}
            className="block text-xs font-semibold text-muted-foreground"
          />
        </div>
      </div>
    </section>
  )
}
