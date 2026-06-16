import { RiErrorWarningLine } from '@remixicon/react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { formatLbp } from '~/lib/currency'
import type { ReconcileResult } from '~/lib/reconcile'

// Checksum-mismatch warning (spec §4.3). Renders nothing when there's no printed
// total to check against, or when the bill reconciles within tolerance.
export function ReconcileBanner({ result }: { result: ReconcileResult }) {
  if (result.printed === null || result.ok) return null
  const diff = result.diff ?? 0
  const over = diff > 0
  return (
    <Alert variant="destructive">
      <RiErrorWarningLine />
      <AlertTitle>Items don't match the printed total</AlertTitle>
      <AlertDescription>
        Items + service + tax = {formatLbp(result.computed)}, but the receipt says{' '}
        {formatLbp(result.printed)} — {over ? 'over' : 'under'} by{' '}
        {formatLbp(Math.abs(diff))}. Fix a quantity or price below.
      </AlertDescription>
    </Alert>
  )
}
