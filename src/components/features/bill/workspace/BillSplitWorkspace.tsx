import { useState } from 'react'
import type { ReactNode } from 'react'
import { RiErrorWarningLine } from '@remixicon/react'
import { Alert, AlertTitle } from '~/components/ui/alert'
import { Dock } from '~/components/ui/dock'
import { formatUsd, toUsd } from '~/lib/money'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { ClaimList } from '../claims'
import { SplitHero } from './SplitHero'
import { PersonRail } from '../people'
import {
  SplitDockCollapsed,
  SPLIT_DOCK_COLLAPSED_HINT,
} from './SplitDockCollapsed'
import { SplitTotalsPanel } from './SplitTotalsPanel'
import { BillScreen } from './BillScreen'
import { TipControl } from './TipControl'
import { WorkspaceHeader } from './WorkspaceHeader'
import { BillSummary, type BillSummaryBill } from '../summary'
import {
  computePortfolios,
  remainingUnits,
  totalRemainingLbp,
} from '~/lib/money'
import type { BillStatus, Person } from '~/lib/types'
import type { ShareItemEvenly } from '~/lib/bill'

interface WorkspaceBill extends BillSummaryBill {
  merchantName: string
  status: BillStatus
}

export function BillSplitWorkspace({
  bill,
  description,
  actionSlot,
  inviteAction,
  notice,
  // people selector (subset of bill.people the viewer controls)
  people,
  activeId,
  selfId,
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
  summaryDescription = 'Updates live as people claim items.',
  onTipChange,
  tipPending = false,
  ownIds,
}: {
  bill: WorkspaceBill
  description: string
  actionSlot?: ReactNode
  inviteAction?: ReactNode
  notice?: ReactNode
  people: Person[]
  selfId?: string
  activeId: string | null
  onSelect: (id: string) => void
  onAdd?: (name: string) => void | Promise<void>
  onRemove?: (id: string) => void
  panelTitle?: string
  panelExtra?: ReactNode
  addLabel?: string
  addPlaceholder?: string
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: ShareItemEvenly
  canShareEvenly?: boolean
  sharePeople?: Person[]
  showClaims?: boolean
  conflictMessage?: string | null
  summaryDescription?: string
  /** Host-only: makes the tip control render (expanded sheet + desktop aside). */
  onTipChange?: (pct: number) => void
  tipPending?: boolean
  /** Ids the viewer controls (e.g. a guest's own people) — sorts those pills
   * first in the person rail/panel. Omit for the host, who controls everyone. */
  ownIds?: ReadonlySet<string>
}) {
  const displayPerson = (person: Person) =>
    person.id === selfId ? { ...person, name: 'You' } : person
  const displayPeople = people.map(displayPerson)
  const displayBillPeople = bill.people.map(displayPerson)
  const activePerson = displayPeople.find((person) => person.id === activeId)

  // Per-person portfolios power the panel totals + the tap-to-reveal breakdowns;
  // computed once over the whole bill.
  const portfolios = computePortfolios({
    lineItems: bill.lineItems,
    people: displayBillPeople,
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

  // Claim status for the collapsed dock's handle.
  const remainingLbp = totalRemainingLbp(bill.lineItems, bill.claims)
  const itemsTotal = bill.lineItems.length
  const itemsClaimed = bill.lineItems.filter(
    (item) => remainingUnits(item, bill.claims) <= 0.0001,
  ).length

  const [totalsExpanded, setTotalsExpanded] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

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
      compactMobile={showClaims}
    />
  )

  // Compact view: nothing to claim (finalized, or a guest who hasn't joined).
  // Here the full summary IS the point, so keep it — and there is no dock.
  if (!showClaims) {
    return (
      <BillScreen header={header} notice={notice} width="narrow">
        {panelExtra}
        {actionSlot}
        <BillSummary
          bill={bill}
          title={bill.status === 'FINALIZED' ? 'Final receipt' : 'Live totals'}
          description={summaryDescription}
        />
      </BillScreen>
    )
  }

  const personPanel = (
    <>
      {panelExtra}
      {tipControl ? (
        <div className="surface-inset px-4 py-3 ring-1 ring-border/40">
          {tipControl}
        </div>
      ) : null}
      <div>
        <h2 className="mb-2 text-sm font-bold text-muted-foreground">
          {panelTitle}
        </h2>
        <PersonRail
          variant="panel"
          people={displayPeople}
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
    <BillScreen
      header={header}
      notice={
        <>
          {notice}
          {conflictMessage ? (
            <Alert variant="warning">
              <RiErrorWarningLine />
              <AlertTitle>{conflictMessage}</AlertTitle>
            </Alert>
          ) : null}
        </>
      }
      aside={
        isDesktop ? (
          <aside className="lg:sticky lg:top-6">
            <div className="surface-panel space-y-4 p-4">
              {personPanel}
              {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
            </div>
          </aside>
        ) : null
      }
      dock={
        <Dock
          collapsedHeightHint={SPLIT_DOCK_COLLAPSED_HINT}
          expanded={totalsExpanded}
          onExpandedChange={setTotalsExpanded}
          keyboardAware
          panelTitle="Table totals"
          panelDescription="Tap a person to see their items."
          handle={{
            label: 'View table totals',
            status:
              remainingLbp > 0.5
                ? `${formatUsd(toUsd(remainingLbp, bill.rate))} left`
                : 'All assigned',
            ariaLabel: `View table totals, ${itemsClaimed} of ${itemsTotal} items assigned`,
          }}
          collapsed={
            <SplitDockCollapsed
              people={displayPeople}
              activeId={activeId}
              selfId={selfId}
              onSelect={onSelect}
              onAdd={onAdd}
              portfolioByPerson={portfolioByPerson}
              ownIds={ownIds}
              lineItems={bill.lineItems}
              claims={bill.claims}
              rate={bill.rate}
              serviceChargeOn={bill.serviceChargeOn}
              tipPercent={bill.tipPercent}
              panelExtra={panelExtra}
              actionSlot={actionSlot}
            />
          }
          panel={
            <SplitTotalsPanel
              breakdownPeople={displayBillPeople}
              selfId={selfId}
              ownIds={ownIds}
              portfolioByPerson={portfolioByPerson}
              lineItems={bill.lineItems}
              claims={bill.claims}
              rate={bill.rate}
              serviceChargeOn={bill.serviceChargeOn}
              tipPercent={bill.tipPercent}
              grandLbp={grandLbp}
              remainingLbp={remainingLbp}
              extra={tipControl}
            />
          }
        />
      }
    >
      <SplitHero
        lineItems={bill.lineItems}
        claims={bill.claims}
        rate={bill.rate}
        inviteAction={inviteAction}
      />
      <ClaimList
        lineItems={bill.lineItems}
        people={displayBillPeople}
        claims={bill.claims}
        activePerson={activePerson ?? null}
        rate={bill.rate}
        onStep={onStep}
        onShareEvenly={onShareEvenly}
        canShareEvenly={canShareEvenly}
        sharePeople={sharePeople?.map(displayPerson)}
      />
    </BillScreen>
  )
}
