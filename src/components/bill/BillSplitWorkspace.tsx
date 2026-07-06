import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { RiExchangeDollarLine, RiGroupLine } from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { ClaimList } from '~/components/bill/ClaimList'
import { SplitHero } from '~/components/bill/SplitHero'
import { PersonRail } from '~/components/bill/PersonRail'
import { MobileSplitSheet } from '~/components/bill/MobileSplitSheet'
import { TipControl } from '~/components/bill/TipControl'
import { BillSummary, type BillSummaryBill } from '~/components/bill/BillSummary'
import {
  computePortfolios,
  effectiveUnitPrice,
  remainingUnits,
  totalRemainingLbp,
} from '~/lib/split'
import { formatLbp } from '~/lib/currency'
import type { BillStatus, Person } from '~/lib/types'

interface WorkspaceBill extends BillSummaryBill {
  merchantName: string
  status: BillStatus
}

function statusLabel(status: BillStatus) {
  if (status === 'FINALIZED') return 'Finalized'
  if (status === 'PUBLISHED') return 'Shared'
  if (status === 'READY') return 'Draft'
  if (status === 'NEEDS_REVIEW') return 'Needs review'
  return 'Processing'
}

export function BillSplitWorkspace({
  bill,
  description,
  actionSlot,
  notice,
  // people selector (subset of bill.people the viewer controls)
  people,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  panelTitle = 'Assigning to',
  panelExtra,
  addLabel,
  addPlaceholder,
  // claiming
  onStep,
  onShareEvenly,
  canShareEvenly = true,
  sharePeople,
  showClaims = true,
  conflictMessage,
  savingMessage,
  summaryDescription = 'Updates live as people claim items.',
  onTipChange,
  tipPending = false,
  pendingItemId,
}: {
  bill: WorkspaceBill
  description: string
  actionSlot?: ReactNode
  notice?: ReactNode
  people: Person[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd?: (name: string) => void
  onRemove?: (id: string) => void
  panelTitle?: string
  panelExtra?: ReactNode
  addLabel?: string
  addPlaceholder?: string
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: (itemId: string, personIds: string[]) => void
  canShareEvenly?: boolean
  sharePeople?: Person[]
  showClaims?: boolean
  conflictMessage?: string | null
  savingMessage?: string | null
  summaryDescription?: string
  /** Host-only: makes the tip control render (expanded sheet + desktop aside). */
  onTipChange?: (pct: number) => void
  tipPending?: boolean
  /** Item currently round-tripping a claim write — gets a pending pulse. */
  pendingItemId?: string | null
}) {
  // Per-person portfolios power the panel totals + the tap-to-reveal breakdowns;
  // computed once over the whole bill.
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
  const portfolioByPerson = new Map(portfolios.map((p) => [p.personId, p]))
  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const tipLbp = portfolios.reduce((s, p) => s + p.tipShareLbp, 0)

  // Live claim progress for the mobile dock's handle (SplitHero keeps its own
  // identical math — both are cheap pure loops).
  const remainingLbp = totalRemainingLbp(bill.lineItems, bill.claims)
  const billTotalLbp = bill.lineItems.reduce(
    (s, item) => s + item.qty * effectiveUnitPrice(item),
    0,
  )
  const itemsTotal = bill.lineItems.length
  const itemsClaimed = bill.lineItems.filter(
    (item) => remainingUnits(item, bill.claims) <= 0.0001,
  ).length
  const shared = bill.status === 'PUBLISHED' || bill.status === 'FINALIZED'

  // Bottom padding tracks the dock's measured collapsed height so the last
  // item cards never hide under it (the old fixed pb-60 was too short).
  const [dockHeight, setDockHeight] = useState(240)

  const tipControl =
    onTipChange && bill.status !== 'FINALIZED' ? (
      <TipControl
        value={bill.tipPercent ?? 0}
        onChange={onTipChange}
        pending={tipPending}
        tipLbp={tipLbp}
        rate={bill.rate}
      />
    ) : null

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <RiGroupLine className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
              {bill.merchantName || 'Split it'}
            </h1>
            <Badge
              variant={bill.status === 'FINALIZED' ? 'secondary' : 'outline'}
            >
              {statusLabel(bill.status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {bill.status === 'PUBLISHED' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500" />
            Link live
          </span>
        ) : null}
        {bill.rate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <RiExchangeDollarLine className="size-4" />
            <span className="tabular-nums">$1 = {formatLbp(bill.rate)}</span>
          </span>
        ) : null}
      </div>
    </div>
  )

  // Compact view: nothing to claim (finalized, or a guest who hasn't joined).
  // Here the full summary IS the point, so keep it.
  if (!showClaims) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 p-4 sm:p-6">
        {header}
        {notice}
        {panelExtra}
        {actionSlot}
        <BillSummary
          bill={bill}
          title={bill.status === 'FINALIZED' ? 'Final receipt' : 'Live totals'}
          description={summaryDescription}
        />
      </div>
    )
  }

  const personPanel = (
    <>
      {panelExtra}
      {tipControl ? (
        <div className="rounded-3xl bg-background/70 px-4 py-3 ring-1 ring-border/40">
          {tipControl}
        </div>
      ) : null}
      <div>
        <h2 className="mb-2 text-sm font-bold text-muted-foreground">
          {panelTitle}
        </h2>
        <PersonRail
          variant="panel"
          people={people}
          activeId={activeId}
          onSelect={onSelect}
          onAdd={onAdd}
          onRemove={onRemove}
          portfolioByPerson={portfolioByPerson}
          lineItems={bill.lineItems}
          claims={bill.claims}
          rate={bill.rate}
          serviceChargeOn={bill.serviceChargeOn}
          tipPercent={bill.tipPercent}
          addLabel={addLabel}
          addPlaceholder={addPlaceholder}
        />
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Tap a person's avatar to see their items.
        </p>
      </div>
    </>
  )

  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 pb-[calc(var(--dock-h)+1.5rem)] pt-4 sm:px-6 lg:px-10 lg:pb-10"
      style={{ '--dock-h': `${dockHeight}px` } as CSSProperties}
    >
      <div className="mb-5">{header}</div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {notice}
          <SplitHero
            lineItems={bill.lineItems}
            claims={bill.claims}
            rate={bill.rate}
          />

          {conflictMessage ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {conflictMessage}
            </div>
          ) : null}

          <ClaimList
            lineItems={bill.lineItems}
            people={bill.people}
            claims={bill.claims}
            activePerson={people.find((p) => p.id === activeId) ?? null}
            rate={bill.rate}
            onStep={onStep}
            onShareEvenly={onShareEvenly}
            canShareEvenly={canShareEvenly}
            sharePeople={sharePeople}
            pendingItemId={pendingItemId}
          />

          {savingMessage ? (
            <p className="text-xs text-muted-foreground">{savingMessage}</p>
          ) : null}
        </div>

        {/* Desktop: sticky person panel + actions */}
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <div className="space-y-4 rounded-4xl bg-muted/60 p-4 ring-1 ring-border/40">
            {personPanel}
            {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
          </div>
        </aside>
      </div>

      {/* Mobile: expandable bottom sheet (bar + breakdowns) */}
      <MobileSplitSheet
        people={people}
        breakdownPeople={bill.people}
        activeId={activeId}
        onSelect={onSelect}
        onAdd={onAdd}
        portfolioByPerson={portfolioByPerson}
        lineItems={bill.lineItems}
        claims={bill.claims}
        rate={bill.rate}
        serviceChargeOn={bill.serviceChargeOn}
        tipPercent={bill.tipPercent}
        grandLbp={grandLbp}
        shared={shared}
        remainingLbp={remainingLbp}
        billTotalLbp={billTotalLbp}
        itemsClaimed={itemsClaimed}
        itemsTotal={itemsTotal}
        panelExtra={panelExtra}
        expandedExtra={tipControl}
        actionSlot={actionSlot}
        addPlaceholder={addPlaceholder}
        onCollapsedHeightChange={setDockHeight}
      />
    </div>
  )
}
