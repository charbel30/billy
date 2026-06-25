import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RiArrowLeftLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { BillSummary } from '~/components/bill/BillSummary'
import { billQueries } from '~/queries'
import { recordBill } from '~/lib/billHistory'

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
  const finalized = bill.status === 'FINALIZED'

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
      />

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
