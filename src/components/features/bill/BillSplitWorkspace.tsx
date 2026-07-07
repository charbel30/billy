import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { RiErrorWarningLine } from '@remixicon/react'
import { Alert, AlertTitle } from '~/components/ui/alert'
import { ClaimList } from '~/components/features/bill/ClaimList'
import { SplitHero } from '~/components/features/bill/SplitHero'
import { PersonRail } from '~/components/features/bill/PersonRail'
import { MobileSplitSheet } from '~/components/features/bill/MobileSplitSheet'
import { TipControl } from '~/components/features/bill/TipControl'
import { WorkspaceHeader } from '~/components/features/bill/WorkspaceHeader'
import { BillSummary, type BillSummaryBill } from '~/components/features/bill/BillSummary'
import {
  computePortfolios,
  effectiveUnitPrice,
  remainingUnits,
  totalRemainingLbp,
} from '~/lib/split'
import type { BillStatus, Person } from '~/lib/types'

interface WorkspaceBill extends BillSummaryBill {
  merchantName: string
  status: BillStatus
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
  ownIds,
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
  /** Ids the viewer controls (e.g. a guest's own people) — sorts those pills
   * first in the person rail/panel. Omit for the host, who controls everyone. */
  ownIds?: ReadonlySet<string>
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
    <WorkspaceHeader
      merchantName={bill.merchantName}
      status={bill.status}
      rate={bill.rate}
      description={description}
    />
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
        <div className="rounded-control bg-background/70 px-4 py-3 ring-1 ring-border/40">
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
          ownIds={ownIds}
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
            <Alert variant="warning">
              <RiErrorWarningLine />
              <AlertTitle>{conflictMessage}</AlertTitle>
            </Alert>
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
          <div className="space-y-4 rounded-card bg-muted/60 p-4 ring-1 ring-border/40">
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
        remainingLbp={remainingLbp}
        billTotalLbp={billTotalLbp}
        itemsClaimed={itemsClaimed}
        itemsTotal={itemsTotal}
        panelExtra={panelExtra}
        expandedExtra={tipControl}
        actionSlot={actionSlot}
        addPlaceholder={addPlaceholder}
        onCollapsedHeightChange={setDockHeight}
        ownIds={ownIds}
      />
    </div>
  )
}
