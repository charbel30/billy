import { createFileRoute } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/shared/Loader'
import { SummaryPage } from '~/components/features/summary/SummaryPage'
import { billQueries } from '~/api'

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
  return <SummaryPage billId={billId} />
}
