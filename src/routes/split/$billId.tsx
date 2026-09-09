import { createFileRoute } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { ClaimListSkeleton } from '~/components/features/bill'
import { SplitPage } from '~/components/features/split/SplitPage'
import { HostAccessBoundary } from '~/components/shared/HostAccessBoundary'

export const Route = createFileRoute('/split/$billId')({
  component: Split,
  pendingComponent: () => <ClaimListSkeleton />,
})

function Split() {
  const billId = Route.useParams().billId as Id<'bills'>
  return (
    <HostAccessBoundary billId={billId}>
      <SplitPage billId={billId} />
    </HostAccessBoundary>
  )
}
