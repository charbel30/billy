import { createFileRoute } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/shared/Loader'
import { ReviewPage } from '~/components/features/review/ReviewPage'
import { billQueries } from '~/api'

export const Route = createFileRoute('/review/$billId')({
  component: Review,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Review() {
  const billId = Route.useParams().billId as Id<'bills'>
  return <ReviewPage billId={billId} />
}
