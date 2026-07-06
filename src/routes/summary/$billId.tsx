import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiArrowLeftLine, RiChat1Line } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { BillSummary } from '~/components/bill/BillSummary'
import { ShareSplitCard } from '~/components/bill/ShareSplitCard'
import { billQueries, useRevokeShare, useSetHostPersonPaid } from '~/queries'
import { recordBill } from '~/lib/billHistory'
import { buildTotalsMessage, joinUrl } from '~/lib/shareText'

export const Route = createFileRoute('/summary/$billId')({
  component: Summary,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Summary() {
  const billId = Route.useParams().billId as Id<'bills'>
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

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      {!finalized ? (
        <div className="rounded-3xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This is a live preview. Finalize the split when everyone is done to
          lock the receipt.
        </div>
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

      <Button
        size="lg"
        className="w-full"
        onClick={() => void shareTotalsText()}
        disabled={bill.people.length === 0}
      >
        <RiChat1Line />
        Share totals as text
      </Button>

      {shared ? (
        <section className="rounded-3xl border border-border bg-card p-4">
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
      ) : null}

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
  )
}
