import { AnimatedAmount } from '~/components/ui/animated-amount'
import { PortfolioReceipt } from '~/components/features/bill/PortfolioReceipt'
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
  tipPercent?: number | null
  rate?: number | null
}

// Per-person "little receipts" plus the grand total. USD is the headline figure
// with LBP underneath (matches the redesigned review screen) — no currency toggle.
// Mark-as-paid (opt-in via onTogglePaid): each receipt gets a "Mark paid" ↔
// "Paid ✓" chip, gated per person by canTogglePaid.
export function BillSummary({
  bill,
  title = 'Totals',
  description,
  className,
  onTogglePaid,
  canTogglePaid,
  paidPendingId,
}: {
  bill: BillSummaryBill
  title?: string
  description?: string
  className?: string
  onTogglePaid?: (personId: string, paid: boolean) => void
  /** Gates which receipts get an interactive toggle (e.g. a guest's own people).
   *  Without it every receipt is toggleable when onTogglePaid is set. */
  canTogglePaid?: (personId: string) => boolean
  paidPendingId?: string | null
}) {
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
  const tipLbp = portfolios.reduce((s, p) => s + p.tipShareLbp, 0)
  const paidAtById = new Map(bill.people.map((p) => [p.id, p.paidAt]))

  return (
    <section className={cn('space-y-3', className)}>
      <div>
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {!bill.rate && (
        <p className="rounded-control bg-warning-subtle px-4 py-3 text-sm text-warning-subtle-foreground">
          No rate set — USD shows as $0.00. Add the venue rate on the review
          screen.
        </p>
      )}

      <div className="space-y-3">
        {portfolios.map((p) => {
          const toggleable =
            onTogglePaid && (canTogglePaid ? canTogglePaid(p.personId) : true)
          return (
            <PortfolioReceipt
              key={p.personId}
              portfolio={p}
              lines={personClaimedLines(p.personId, bill.lineItems, bill.claims)}
              rate={bill.rate}
              serviceChargeOn={bill.serviceChargeOn}
              tipPercent={bill.tipPercent}
              paidAt={paidAtById.get(p.personId)}
              onTogglePaid={
                toggleable ? (paid) => onTogglePaid(p.personId, paid) : undefined
              }
              togglePending={paidPendingId === p.personId}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-card bg-muted/70 px-4 py-3 ring-1 ring-border/40">
        <div>
          <span className="block font-bold text-muted-foreground">
            Grand total
          </span>
          {tipLbp > 0 && bill.tipPercent ? (
            <span className="block text-[11px] font-semibold text-muted-foreground/80">
              incl. {bill.tipPercent}% tip
            </span>
          ) : null}
        </div>
        <div className="text-right">
          <AnimatedAmount
            value={toUsd(grandLbp, bill.rate)}
            format={formatUsd}
            className="block text-xl font-bold tracking-tight text-primary-strong"
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
