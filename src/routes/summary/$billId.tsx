import { createFileRoute } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/shared/Loader'
import { SummaryPage } from '~/components/features/summary/SummaryPage'
import { HostAccessBoundary } from '~/components/shared/HostAccessBoundary'

export const Route = createFileRoute('/summary/$billId')({
  component: Summary,
  pendingComponent: () => <Loader />,
})

function Summary() {
  const billId = Route.useParams().billId as Id<'bills'>
  return (
    <HostAccessBoundary billId={billId}>
      <SummaryPage billId={billId} />
    </HostAccessBoundary>
  )
}
