import { createFileRoute, redirect } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { ClaimListSkeleton } from '~/components/features/bill'
import { SplitPage } from '~/components/features/split/SplitPage'
import { HostAccessBoundary } from '~/components/shared/HostAccessBoundary'
import { ensureHostBill } from '~/api'
import { highestEnabledStep, stepAvailability, STEP_PATH } from '~/lib/bill/steps'

export const Route = createFileRoute('/split/$billId')({
  loader: async ({ context, params }) => {
    const billId = params.billId as Id<'bills'>
    const bill = await ensureHostBill(context.queryClient, billId)
    if (!bill) return
    const dest = highestEnabledStep('split', stepAvailability(bill))
    if (dest !== 'split') {
      throw redirect({ to: STEP_PATH[dest], params: { billId } })
    }
  },
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
