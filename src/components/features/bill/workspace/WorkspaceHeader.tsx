import { motion } from 'motion/react'
import { RiExchangeDollarLine, RiGroupLine } from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { formatLbp } from '~/lib/money'
import { statusLabel } from '~/lib/bill'
import { crossfadeHidden, crossfadeShown, crossfadeSpring } from '~/lib/ui'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import { CURRENCY_DISPLAYS, type CurrencyDisplay } from '~/lib/session'
import type { BillStatus } from '~/lib/types'

// The mode chip + accessible copy for each display state.
const DISPLAY_CHIP: Record<CurrencyDisplay, string> = {
  both: '$+LL',
  usd: '$',
  lbp: 'LL',
}
const DISPLAY_LABEL: Record<CurrencyDisplay, string> = {
  both: 'Prices shown in dollars and pounds',
  usd: 'Prices shown in dollars',
  lbp: 'Prices shown in pounds',
}

// Workspace title row: merchant name + status badge on the left, live-link and
// rate pills on the right. Shared by the host split screen and the guest view.
export function WorkspaceHeader({
  merchantName,
  status,
  rate,
  description,
}: {
  merchantName: string
  status: BillStatus
  rate: number | null | undefined
  description: string
}) {
  const { display, cycleDisplay } = useCurrencyDisplay()
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-control bg-primary/10 text-primary-strong">
          <RiGroupLine className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
              {merchantName || 'Split it'}
            </h1>
            <Badge variant={status === 'FINALIZED' ? 'secondary' : 'outline'}>
              {statusLabel(status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {status === 'PUBLISHED' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-subtle px-3 py-1.5 text-xs font-semibold text-success-subtle-foreground ring-1 ring-success/20">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            Link live
          </span>
        ) : null}
        {rate ? (
          <button
            type="button"
            onClick={cycleDisplay}
            aria-label={`${DISPLAY_LABEL[display]} — tap to change`}
            title={`${DISPLAY_LABEL[display]} — tap to change`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-strong transition-transform active:scale-[0.96]"
          >
            <RiExchangeDollarLine className="size-4" />
            <span className="tabular-nums">$1 = {formatLbp(rate)}</span>
            {/* All three labels stay stacked in one cell so the chip (and the
                pill) never changes width mid-cycle — same crossfade as prices. */}
            <span className="grid justify-items-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold tabular-nums [&>*]:col-start-1 [&>*]:row-start-1">
              {CURRENCY_DISPLAYS.map((d) => (
                <motion.span
                  key={d}
                  aria-hidden={d !== display}
                  initial={false}
                  animate={d === display ? crossfadeShown : crossfadeHidden}
                  transition={crossfadeSpring}
                >
                  {DISPLAY_CHIP[d]}
                </motion.span>
              ))}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
