import { useState } from 'react'
import { RiChat1Line, RiQrCodeLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { Dock } from '~/components/ui/dock'
import { tapHaptic } from '~/lib/ui'
import { formatLbpCompact } from '~/lib/format'
import { summaryCopy } from '../content'

/**
 * Declared collapsed height at 390px: handle + share/QR row. The dock
 * re-measures after mount.
 */
export const SUMMARY_DOCK_COLLAPSED_HINT = 120

function SummaryDockCollapsed({
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

export function SummarySettlementPanel({
  rate,
  tipPercent,
}: {
  rate: number | null | undefined
  tipPercent?: number | null
}) {
  return (
    <div className="space-y-3">
      <div className="surface-inset px-3 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {summaryCopy.dock.rate}
        </p>
        <p className="font-receipt text-sm font-semibold tabular-nums">
          1 USD = {formatLbpCompact(rate ?? 0)} LL
        </p>
      </div>
      <div className="surface-inset px-3 py-2.5">
        <p className="text-sm font-semibold">
          {tipPercent
            ? summaryCopy.dock.tip(tipPercent)
            : summaryCopy.dock.noTip}
        </p>
      </div>
    </div>
  )
}

/** The summary screen's dock: share actions, settlement details behind the handle. */
export function SummaryDock({
  onShareTotals,
  onShowQr,
  shareDisabled = false,
  rate,
  tipPercent,
  onCollapsedHeightChange,
}: {
  onShareTotals: () => void
  onShowQr?: () => void
  shareDisabled?: boolean
  rate: number | null | undefined
  tipPercent?: number | null
  onCollapsedHeightChange?: (px: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Dock
      collapsedHeightHint={SUMMARY_DOCK_COLLAPSED_HINT}
      onCollapsedHeightChange={onCollapsedHeightChange}
      expanded={expanded}
      onExpandedChange={setExpanded}
      panelTitle={summaryCopy.dock.handle}
      panelDescription={summaryCopy.dock.panelDescription}
      handle={{
        label: summaryCopy.dock.handle,
        ariaLabel: summaryCopy.dock.ariaLabel,
      }}
      collapsed={
        <SummaryDockCollapsed
          onShareTotals={onShareTotals}
          onShowQr={onShowQr}
          shareDisabled={shareDisabled}
        />
      }
      panel={<SummarySettlementPanel rate={rate} tipPercent={tipPercent} />}
    />
  )
}
