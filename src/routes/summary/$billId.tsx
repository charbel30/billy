import { createFileRoute, redirect } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/shared/Loader'
import { SummaryPage } from '~/components/features/summary/SummaryPage'
import { HostAccessBoundary } from '~/components/shared/HostAccessBoundary'
import { ensureHostBill } from '~/api'
import { highestEnabledStep, stepAvailability, STEP_PATH } from '~/lib/bill/steps'

export const Route = createFileRoute('/summary/$billId')({
  loader: async ({ context, params }) => {
    const billId = params.billId as Id<'bills'>
    const bill = await ensureHostBill(context.queryClient, billId)
    if (!bill) return
    const dest = highestEnabledStep('summary', stepAvailability(bill))
    if (dest !== 'summary') {
      throw redirect({ to: STEP_PATH[dest], params: { billId } })
    }
  },
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
