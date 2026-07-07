import { createFileRoute } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/shared/Loader'
import { SplitPage } from '~/components/features/split/SplitPage'
import { billQueries } from '~/api'

export const Route = createFileRoute('/split/$billId')({
  component: Split,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Split() {
  const billId = Route.useParams().billId as Id<'bills'>
  return <SplitPage billId={billId} />
}
