import { RiArrowRightLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { Dock } from '~/components/ui/dock'
import { formatUsd, toUsd } from '~/lib/money'
import type { ReconcileResult } from '~/lib/money'
import { formatLbpCompact } from '~/lib/format'
import { tapHaptic } from '~/lib/ui'
import type { SaveState } from '~/lib/bill/editorSession'
import type { WorkingMeta } from '~/lib/bill/types'
import { ReviewSettlementPanel } from './ReviewSettlementPanel'
import { reviewCopy } from '../content'

/**
 * Declared collapsed height of the review dock at 390px: 64px handle + 20px
 * padding + a 66px total/CTA row. Only has to be right for the first frame —
 * the dock re-measures the row itself and corrects before paint.
 */
export const REVIEW_DOCK_COLLAPSED_HINT = 150

/** The bill total and the way forward — the collapsed row of the review dock. */
export function ReviewDockCollapsed({
  total,
  rate,
  canContinue,
  onContinue,
}: {
  total: number
  rate: number | null | undefined
  canContinue: boolean
  onContinue: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {reviewCopy.dock.totalLabel}
        </span>
        <AnimatedAmount
          value={toUsd(total, rate)}
          format={formatUsd}
          className="block text-3xl font-black leading-none tracking-tight text-primary-strong"
        />
        <AnimatedAmount
          value={total}
          format={formatLbpCompact}
          className="mt-1 block text-xs font-bold text-primary-strong/80"
        />
      </div>
      <Button
        size="lg"
        className="min-h-12 shrink-0 shadow-raised active:scale-[0.96]"
        disabled={!canContinue}
        onClick={() => {
          tapHaptic()
          onContinue()
        }}
      >
        {reviewCopy.dock.proceed}
        <RiArrowRightLine />
      </Button>
    </div>
  )
}

/** The review screen's dock: total + proceed, settlement details behind the handle. */
export function ReviewDock({
  total,
  recon,
  meta,
  onMetaChange,
  canContinue,
  onContinue,
  expanded,
  onExpandedChange,
  saveState,
  onRetrySave,
  onCollapsedHeightChange,
}: {
  total: number
  recon: ReconcileResult
  meta: WorkingMeta
  onMetaChange: (patch: Partial<WorkingMeta>) => void
  canContinue: boolean
  onContinue: () => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  saveState: SaveState
  onRetrySave: () => void
  onCollapsedHeightChange?: (px: number) => void
}) {
  const hasPrintedTotal = meta.printedTotalLbp != null

  return (
    <Dock
      collapsedHeightHint={REVIEW_DOCK_COLLAPSED_HINT}
      onCollapsedHeightChange={onCollapsedHeightChange}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      panelTitle={reviewCopy.dock.handle}
      panelDescription={reviewCopy.dock.panelDescription}
      handle={{
        label: reviewCopy.dock.handle,
        // Only claim the receipt matches when there is a printed total to match.
        status: hasPrintedTotal
          ? recon.ok
            ? reviewCopy.dock.matches
            : reviewCopy.dock.checkTotals
          : undefined,
        ariaLabel: reviewCopy.dock.ariaLabel,
      }}
      collapsed={
        <ReviewDockCollapsed
          total={total}
          rate={meta.rate}
          canContinue={canContinue}
          onContinue={onContinue}
        />
      }
      panel={
        <ReviewSettlementPanel
          meta={meta}
          onMetaChange={onMetaChange}
          recon={recon}
          saveState={saveState}
          onRetrySave={onRetrySave}
        />
      }
    />
  )
}
