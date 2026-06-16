import type { ReactNode } from 'react'
import { Badge } from '~/components/ui/badge'
import { ClaimList } from '~/components/bill/ClaimList'
import { RemainingBar } from '~/components/bill/RemainingBar'
import { BillSummary, type BillSummaryBill } from '~/components/bill/BillSummary'
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
  editorSlot,
  activePerson,
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
  editorSlot?: ReactNode
  activePerson: Person | null
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: (itemId: string, personIds: string[]) => void
  canShareEvenly?: boolean
  sharePeople?: Person[]
  showClaims?: boolean
  conflictMessage?: string | null
  savingMessage?: string | null
  summaryDescription?: string
}) {
  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black">
              {bill.merchantName || 'Split it'}
            </h1>
            <Badge variant={bill.status === 'FINALIZED' ? 'secondary' : 'outline'}>
              {statusLabel(bill.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          {bill.rate ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatLbp(bill.rate)} / $1
            </p>
          ) : null}
        </div>
      </div>

      {notice}
      {editorSlot}

      {showClaims ? (
        <>
          <RemainingBar lineItems={bill.lineItems} claims={bill.claims} />

          {conflictMessage ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {conflictMessage}
            </div>
          ) : null}

          <div className="rounded-3xl border border-border bg-card p-4">
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
          </div>

          {savingMessage ? (
            <p className="text-xs text-muted-foreground">{savingMessage}</p>
          ) : null}
        </>
      ) : null}

      {actionSlot}

      <BillSummary
        bill={bill}
        title={bill.status === 'FINALIZED' ? 'Final receipt' : 'Live totals'}
        description={summaryDescription}
      />
    </div>
  )
}
