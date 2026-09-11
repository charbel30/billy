import { motion } from 'motion/react'
import { RiArrowRightLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { Dock } from '~/components/ui/dock'
import { formatUsd, toUsd } from '~/lib/money'
import type { ReconcileResult } from '~/lib/money'
import { formatLbpCompact } from '~/lib/format'
import { fadeRise, tapHaptic } from '~/lib/ui'
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
  revealDelay,
}: {
  total: number
  rate: number | null | undefined
  canContinue: boolean
  onContinue: () => void
  /** Seconds to wait before rising in; set only on an extraction reveal. */
  revealDelay?: number
}) {
  const revealing = revealDelay != null
  return (
    <motion.div
      className="flex items-center justify-between gap-3"
      initial={revealing ? { ...fadeRise.initial, y: 24 } : false}
      animate={fadeRise.animate}
      transition={
        revealing
          ? { ...fadeRise.transition, delay: revealDelay }
          : { duration: 0 }
      }
    >
      <div className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {reviewCopy.dock.totalLabel}
        </span>
        <div style={{ viewTransitionName: 'bill-total' }}>
          <AnimatedAmount
            value={toUsd(total, rate)}
            initialValue={revealing ? 0 : undefined}
            initialDelayMs={revealing ? revealDelay * 1000 : undefined}
            format={formatUsd}
            className="block text-3xl font-black leading-none tracking-tight text-primary-strong"
          />
        </div>
        <AnimatedAmount
          value={total}
          initialValue={revealing ? 0 : undefined}
          initialDelayMs={revealing ? revealDelay * 1000 : undefined}
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
    </motion.div>
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
  revealDelay,
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
  /** Rise in after the line items, once, when a scan reveals the editor. */
  revealDelay?: number
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
          revealDelay={revealDelay}
        />
      }
      panel={
        <ReviewSettlementPanel
          meta={meta}
          onMetaChange={onMetaChange}
          recon={recon}
          saveState={saveState}
          onRetrySave={onRetrySave}
          rateDefaultOpen
        />
      }
    />
  )
}
