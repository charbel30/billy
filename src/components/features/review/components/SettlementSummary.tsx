import { RiArrowRightLine, RiReceiptLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { formatUsd, toUsd } from '~/lib/money'
import type { ReconcileResult } from '~/lib/money'
import { formatLbpCompact } from '~/lib/format'
import type { SaveState } from '~/lib/bill/editorSession'
import type { WorkingMeta } from '~/lib/bill/types'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { ReviewSettlementPanel } from './ReviewSettlementPanel'
import { reviewCopy } from '../content'

const DESKTOP = '(min-width: 1024px)'

// Desktop aside: the same content as the mobile dock (collapsed total + the
// settlement panel), laid out as a sticky column. Not mounted below lg so the
// travelling `bill-total` name lives on exactly one element (the dock on
// mobile, this headline on desktop).
export function SettlementSummary({
  total,
  recon,
  meta,
  onMetaChange,
  canContinue,
  onContinue,
  readOnly = false,
  saveState,
  onRetrySave,
}: {
  total: number
  recon: ReconcileResult
  meta: WorkingMeta
  onMetaChange: (patch: Partial<WorkingMeta>) => void
  canContinue: boolean
  onContinue: () => void
  readOnly?: boolean
  saveState?: SaveState
  onRetrySave?: () => void
}) {
  const isDesktop = useMediaQuery(DESKTOP)
  if (!isDesktop) return null

  return (
    <aside className="lg:sticky lg:top-24">
      <section className="surface-panel p-5 shadow-raised sm:p-6">
        <h2 className="mb-5 flex items-center gap-2 text-base font-black">
          <RiReceiptLine className="size-5" />
          {reviewCopy.dock.handle}
        </h2>

        <div className="mb-5 flex items-end justify-between">
          <span className="text-3xl font-black tracking-tight">
            {reviewCopy.dock.totalLabel}
          </span>
          <div className="text-right" style={{ viewTransitionName: 'bill-total' }}>
            <AnimatedAmount
              value={toUsd(total, meta.rate)}
              format={formatUsd}
              className="block text-4xl font-black tracking-tight text-primary-strong"
            />
            <AnimatedAmount
              value={total}
              format={formatLbpCompact}
              className="block text-sm font-semibold text-primary-strong/80"
            />
          </div>
        </div>

        <ReviewSettlementPanel
          meta={meta}
          onMetaChange={onMetaChange}
          recon={recon}
          readOnly={readOnly}
          saveState={readOnly ? undefined : saveState}
          onRetrySave={readOnly ? undefined : onRetrySave}
        />

        {readOnly ? null : (
          <Button
            size="lg"
            className="mt-6 h-14 w-full text-base shadow-raised active:scale-[0.96]"
            disabled={!canContinue}
            onClick={onContinue}
          >
            {reviewCopy.dock.proceed}
            <RiArrowRightLine />
          </Button>
        )}
      </section>
    </aside>
  )
}
