import type { ReactNode } from 'react'
import { metadataError, lineItemsError } from '~/lib/bill/validation'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { PortfolioReceipt } from '../receipt'
import {
  computePortfolios,
  unallocatedAmounts,
  personClaimedLines,
  formatLbp,
  formatUsd,
  toUsd,
  type Portfolio,
} from '~/lib/money'
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

function groupPortfolios(portfolios: Portfolio[], people: Person[]) {
  const paidAt = new Map(people.map((p) => [p.id, p.paidAt]))
  const unpaid = portfolios
    .filter((p) => p.totalLbp > 0 && paidAt.get(p.personId) == null)
    .sort((a, b) => b.totalLbp - a.totalLbp)
  const paid = portfolios
    .filter((p) => p.totalLbp > 0 && paidAt.get(p.personId) != null)
    .sort(
      (a, b) => (paidAt.get(a.personId) ?? 0) - (paidAt.get(b.personId) ?? 0),
    )
  const nothing = portfolios.filter((p) => p.totalLbp <= 0)
  return { unpaid, paid, nothing, paidAt }
}

// Per-person "little receipts" plus the grand total. USD is the headline figure
// with LBP underneath (matches the redesigned review screen) — no currency toggle.
export function BillSummary({
  bill,
  title = 'Totals',
  description,
  className,
  onTogglePaid,
  canTogglePaid,
  paidPendingId,
  onSend,
  sendPendingId,
  sendLabel,
  sortUnpaidFirst = false,
  header,
  hideGrandTotal = false,
  nothingClaimedLabel,
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
  onSend?: (personId: string) => void
  sendPendingId?: string | null
  sendLabel?: (name: string) => string
  sortUnpaidFirst?: boolean
  header?: ReactNode
  hideGrandTotal?: boolean
  nothingClaimedLabel?: string
}) {
  const invalid =
    metadataError({ ...bill, currencyPrimary: 'LBP' }) ??
    lineItemsError(bill.lineItems)
  if (invalid)
    return (
      <p role="alert" className="rounded-control bg-warning-subtle p-4 text-sm">
        Amounts need correction before settling: {invalid} Ask the host to
        review the receipt.
      </p>
    )

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
  const unallocated = unallocatedAmounts(bill)
  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const tipLbp = portfolios.reduce((s, p) => s + p.tipShareLbp, 0)
  const grouped = sortUnpaidFirst
    ? groupPortfolios(portfolios, bill.people)
    : {
        unpaid: portfolios,
        paid: [] as Portfolio[],
        nothing: [] as Portfolio[],
        paidAt: new Map(bill.people.map((p) => [p.id, p.paidAt])),
      }

  function renderReceipt(p: Portfolio) {
    const toggleable =
      onTogglePaid && (canTogglePaid ? canTogglePaid(p.personId) : true)
    const sendable =
      onSend && (canTogglePaid ? canTogglePaid(p.personId) : true)
    return (
      <PortfolioReceipt
        key={p.personId}
        portfolio={p}
        lines={personClaimedLines(p.personId, bill.lineItems, bill.claims)}
        rate={bill.rate}
        serviceChargeOn={bill.serviceChargeOn}
        tipPercent={bill.tipPercent}
        paidAt={grouped.paidAt.get(p.personId)}
        onTogglePaid={
          toggleable ? (paid) => onTogglePaid(p.personId, paid) : undefined
        }
        togglePending={paidPendingId === p.personId}
        onSend={sendable ? () => onSend(p.personId) : undefined}
        sendPending={sendPendingId === p.personId}
        sendLabel={sendLabel?.(p.name)}
      />
    )
  }

  return (
    <section className={cn('space-y-3', className)}>
      {header !== undefined ? (
        header
      ) : (
        <div>
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}

      {unallocated.totalLbp > 0 ? (
        <p className="rounded-control bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
          Unallocated: {formatLbp(unallocated.totalLbp)}. This amount is
          excluded from everyone’s totals.
          {unallocated.serviceLbp > 0
            ? ' Proportional service and tax need a claimed subtotal; claim a priced item or choose even service splitting.'
            : ''}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        LBP totals use whole lira. USD totals share any rounding cents so
        everyone’s amounts add up.
      </p>
      <div className="space-y-3">
        {sortUnpaidFirst ? (
          <>
            {grouped.unpaid.map(renderReceipt)}
            {grouped.paid.map(renderReceipt)}
            {grouped.nothing.length > 0 ? (
              <div className="space-y-3">
                {nothingClaimedLabel ? (
                  <p className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {nothingClaimedLabel}
                  </p>
                ) : null}
                {grouped.nothing.map(renderReceipt)}
              </div>
            ) : null}
          </>
        ) : (
          grouped.unpaid.map(renderReceipt)
        )}
      </div>

      {hideGrandTotal ? null : (
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
      )}
    </section>
  )
}
