import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiArrowLeftLine, RiChat1Line, RiInformationLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import { Alert, AlertTitle } from '~/components/ui/alert'
import { BillSummary, ShareSplitCard } from '~/components/features/bill'
import { billQueries, useRevokeShare, useSetHostPersonPaid } from '~/api'
import { recordBill } from '~/lib/session'
import { buildTotalsMessage, joinUrl } from '~/lib/format'

export function SummaryPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
  const revokeShare = useRevokeShare()
  const setHostPersonPaid = useSetHostPersonPaid()
  const finalized = bill.status === 'FINALIZED'
  const shared = bill.status === 'PUBLISHED' || finalized

  async function shareTotalsText() {
    const text = buildTotalsMessage(
      bill,
      shared ? joinUrl(bill.shareToken) : null,
    )
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Totals copied — paste them in the group chat')
    } catch {
      toast(text)
    }
  }

  useEffect(() => {
    recordBill({ billId, step: 'summary', name: bill.merchantName })
  }, [billId, bill.merchantName])

  const shareCard = shared ? (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="mb-3 text-center text-sm font-bold text-muted-foreground">
        Guests can scan to {finalized ? 'see the receipt' : 'claim items'}
      </h2>
      <ShareSplitCard
        url={joinUrl(bill.shareToken)}
        merchantName={bill.merchantName}
        onRevoke={
          finalized
            ? undefined
            : async () => {
                await revokeShare.mutateAsync({ id: billId })
              }
        }
      />
    </section>
  ) : null

  return (
    // Mobile: single column. Desktop: receipts left, sticky share card right —
    // pragmatic, not a separate design.
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-4">
        {!finalized ? (
          <Alert variant="info">
            <RiInformationLine />
            <AlertTitle>
              This is a live preview. Finalize the split when everyone is done
              to lock the receipt.
            </AlertTitle>
          </Alert>
        ) : null}

        <BillSummary
          bill={bill}
          title={bill.merchantName || 'Final receipt'}
          description={
            finalized
              ? 'This split is finalized and read-only.'
              : 'Preview only. The split can still change.'
          }
          onTogglePaid={
            shared
              ? (personId, paid) =>
                  setHostPersonPaid.mutate({ id: billId, personId, paid })
              : undefined
          }
          paidPendingId={
            setHostPersonPaid.isPending
              ? setHostPersonPaid.variables?.personId
              : null
          }
        />
      </div>

      <div className="mt-4 space-y-4 lg:sticky lg:top-6 lg:mt-0">
        <Button
          size="lg"
          className="w-full"
          onClick={() => void shareTotalsText()}
          disabled={bill.people.length === 0}
        >
          <RiChat1Line />
          Share totals as text
        </Button>

        {shareCard}

        {!finalized ? (
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: '/split/$billId', params: { billId } })}
          >
            <RiArrowLeftLine />
            Back to split
          </Button>
        ) : null}
      </div>
    </div>
  )
}
