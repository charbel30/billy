import { RiErrorWarningLine } from '@remixicon/react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { formatLbp } from '~/lib/money'
import type { ReconcileResult } from '~/lib/money'
import { parseNumericInput } from '~/lib/format'
import type { SaveState } from '~/lib/bill/editorSession'
import type { WorkingMeta } from '~/lib/bill/types'
import { CompactServiceTaxControl } from './CompactServiceTaxControl'
import { RateField } from './RateField'
import { SaveStatus } from './SaveStatus'
import { reviewCopy } from '../content'

/**
 * Everything about how the bill settles that isn't a line item: service & tax,
 * the exchange rate, the printed-total check and the save state. Rendered in
 * the review dock's panel on mobile and in the desktop aside.
 */
export function ReviewSettlementPanel({
  meta,
  onMetaChange,
  recon,
  readOnly = false,
  saveState,
  onRetrySave,
  rateDefaultOpen = false,
}: {
  meta: WorkingMeta
  onMetaChange: (patch: Partial<WorkingMeta>) => void
  recon: ReconcileResult
  readOnly?: boolean
  /** Omitted in read-only mode, where there is nothing to save. */
  saveState?: SaveState
  onRetrySave?: () => void
  /** Dock panel opens the rate editor; the desktop aside keeps the chip. */
  rateDefaultOpen?: boolean
}) {
  const mismatch =
    recon.diff != null && !recon.ok && meta.printedTotalLbp != null

  return (
    <div className="space-y-3">
      <CompactServiceTaxControl
        meta={meta}
        onChange={onMetaChange}
        readOnly={readOnly}
      />

      <RateField
        rate={meta.rate}
        readOnly={readOnly}
        defaultOpen={rateDefaultOpen}
        onCommit={(raw) =>
          onMetaChange({ rate: parseNumericInput(raw), rateSource: 'manual' })
        }
      />

      {mismatch ? (
        <Alert variant="warning">
          <RiErrorWarningLine />
          <AlertTitle>{reviewCopy.dock.mismatchTitle}</AlertTitle>
          <AlertDescription>
            {reviewCopy.dock.mismatchBody}{' '}
            <span className="font-receipt font-semibold">
              {formatLbp(Math.abs(recon.diff ?? 0))}
            </span>
            {reviewCopy.dock.mismatchHint}
          </AlertDescription>
        </Alert>
      ) : null}

      {saveState && onRetrySave ? (
        <div className="px-1">
          <SaveStatus state={saveState} onRetry={onRetrySave} />
        </div>
      ) : null}
    </div>
  )
}
