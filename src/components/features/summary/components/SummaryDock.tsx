import { RiChat1Line, RiQrCodeLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { Dock } from '~/components/ui/dock'
import { tapHaptic } from '~/lib/ui'
import { summaryCopy } from '../content'

/**
 * Declared collapsed height of the summary dock at 390px: no handle (it never
 * expands), so 24px padding + one 48px button row. Only has to be right for
 * the first frame — the dock re-measures the row itself and corrects.
 */
export const SUMMARY_DOCK_COLLAPSED_HINT = 72

/** Sharing is the whole job of this screen, so it is the whole dock. */
export function SummaryDockCollapsed({
  onShareTotals,
  onShowQr,
  shareDisabled = false,
}: {
  onShareTotals: () => void
  onShowQr?: () => void
  shareDisabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="lg"
        className="min-h-12 flex-1 shadow-raised active:scale-[0.96]"
        disabled={shareDisabled}
        onClick={() => {
          tapHaptic()
          onShareTotals()
        }}
      >
        <RiChat1Line />
        {summaryCopy.shareTotalsShort}
      </Button>
      {onShowQr ? (
        <Button
          size="lg"
          variant="outline"
          aria-label={summaryCopy.showQr}
          title={summaryCopy.showQr}
          className="size-12 shrink-0 p-0 active:scale-[0.96]"
          onClick={() => {
            tapHaptic()
            onShowQr()
          }}
        >
          <RiQrCodeLine />
        </Button>
      ) : null}
    </div>
  )
}

/** The summary screen's dock: share actions only — no panel, no handle. */
export function SummaryDock({
  onShareTotals,
  onShowQr,
  shareDisabled = false,
  onCollapsedHeightChange,
}: {
  onShareTotals: () => void
  onShowQr?: () => void
  shareDisabled?: boolean
  onCollapsedHeightChange?: (px: number) => void
}) {
  return (
    <Dock
      collapsedHeightHint={SUMMARY_DOCK_COLLAPSED_HINT}
      onCollapsedHeightChange={onCollapsedHeightChange}
      expanded={false}
      onExpandedChange={() => {}}
      collapsed={
        <SummaryDockCollapsed
          onShareTotals={onShareTotals}
          onShowQr={onShowQr}
          shareDisabled={shareDisabled}
        />
      }
    />
  )
}
