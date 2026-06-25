import type { ReactNode } from 'react'
import { Badge } from '~/components/ui/badge'
import { ClaimList } from '~/components/bill/ClaimList'
import { SplitHero } from '~/components/bill/SplitHero'
import { PersonRail } from '~/components/bill/PersonRail'
import { BillSummary, type BillSummaryBill } from '~/components/bill/BillSummary'
import { computePortfolios } from '~/lib/split'
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
}) {
  const activePerson = people.find((p) => p.id === activeId) ?? null

  // Per-person totals power the panel rows; computed once over the whole bill.
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
  const totalsByPerson = new Map(portfolios.map((p) => [p.personId, p.totalUsd]))

  const header = (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          {bill.merchantName || 'Split it'}
        </h1>
        <Badge variant={bill.status === 'FINALIZED' ? 'secondary' : 'outline'}>
          {statusLabel(bill.status)}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {bill.rate ? (
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {formatLbp(bill.rate)} / $1
        </p>
      ) : null}
    </div>
  )

  // Compact view: nothing to claim (finalized, or a guest who hasn't joined).
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
          totalsByPerson={totalsByPerson}
          addLabel={addLabel}
          addPlaceholder={addPlaceholder}
        />
      </div>
    </>
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-60 pt-4 sm:px-6 lg:px-10 lg:pb-10">
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
            activePerson={activePerson}
            rate={bill.rate}
            onStep={onStep}
            onShareEvenly={onShareEvenly}
            canShareEvenly={canShareEvenly}
            sharePeople={sharePeople}
          />

          {savingMessage ? (
            <p className="text-xs text-muted-foreground">{savingMessage}</p>
          ) : null}

          <BillSummary
            bill={bill}
            title={bill.status === 'FINALIZED' ? 'Final receipt' : 'Live totals'}
            description={summaryDescription}
          />
        </div>

        {/* Desktop: sticky person panel + actions */}
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <div className="space-y-4 rounded-4xl bg-muted/60 p-4 ring-1 ring-border/40">
            {personPanel}
            {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
          </div>
        </aside>
      </div>

      {/* Mobile: fixed participant bar + action */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-4 pt-8 lg:hidden">
        <div className="mx-auto max-w-md space-y-2 rounded-[2rem] bg-muted/95 p-3 shadow-[0_-18px_54px_rgba(0,0,0,0.10)] ring-1 ring-border/60 backdrop-blur-xl">
          {panelExtra ? <div>{panelExtra}</div> : null}
          <PersonRail
            variant="bar"
            people={people}
            activeId={activeId}
            onSelect={onSelect}
            onAdd={onAdd}
            totalsByPerson={totalsByPerson}
            addPlaceholder={addPlaceholder}
          />
          {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
