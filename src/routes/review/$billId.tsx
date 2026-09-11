import { createFileRoute } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/shared/Loader'
import { ReviewPage } from '~/components/features/review/ReviewPage'
import { HostAccessBoundary } from '~/components/shared/HostAccessBoundary'
import { ensureHostBill } from '~/api'

export const Route = createFileRoute('/review/$billId')({
  loader: ({ context, params }) =>
    ensureHostBill(context.queryClient, params.billId as Id<'bills'>),
  component: Review,
  pendingComponent: () => <Loader />,
})

function Review() {
  const billId = Route.useParams().billId as Id<'bills'>
  return (
    <HostAccessBoundary billId={billId}>
      <ReviewPage key={billId} billId={billId} />
    </HostAccessBoundary>
  )
}
