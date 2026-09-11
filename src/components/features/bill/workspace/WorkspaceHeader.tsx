import type { ComponentType, ReactNode } from 'react'
import { motion } from 'motion/react'
import { RiEditLine, RiExchangeDollarLine, RiGroupLine } from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatLbp } from '~/lib/money'
import { statusLabel } from '~/lib/bill'
import { crossfadeHidden, crossfadeShown, crossfadeSpring } from '~/lib/ui'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import { CURRENCY_DISPLAYS, type CurrencyDisplay } from '~/lib/session'
import type { BillStatus } from '~/lib/types'
import { cn } from '~/lib/utils'

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

// The header of every bill screen: icon tile, merchant name + status badge on
// the left, live-link and rate pills on the right. Review makes the name
// editable and adds a pencil onto the rate chip; summary swaps the icon.
export function WorkspaceHeader({
  merchantName,
  status,
  rate,
  description,
  compactMobile = false,
  icon: Icon = RiGroupLine,
  onNameCommit,
  onRateEdit,
  displayToggle = true,
  trailing,
}: {
  merchantName: string
  status: BillStatus
  rate: number | null | undefined
  description: string
  compactMobile?: boolean
  /** Tile icon; defaults to the split screen's group icon. */
  icon?: ComponentType<{ className?: string }>
  /** When set, the title becomes a tap-to-edit field instead of static text. */
  onNameCommit?: (name: string) => void
  /** When set, a pencil beside the rate chip opens the screen's rate editor. */
  onRateEdit?: () => void
  /** Renders the $+LL / $ / LL cycle chip; default true. */
  displayToggle?: boolean
  /** Optional trailing slot (review: the compare-with-photo thumbnail). */
  trailing?: ReactNode
}) {
  const { display, cycleDisplay } = useCurrencyDisplay()
  return (
    <div
      className={cn(
        'flex justify-between gap-3',
        compactMobile
          ? 'items-center lg:flex-wrap lg:items-start'
          : 'flex-wrap items-start',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            'size-11 shrink-0 place-items-center rounded-control bg-primary/10 text-primary-strong',
            compactMobile ? 'hidden lg:grid' : 'grid',
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {onNameCommit ? (
              <BlurCommitInput
                value={merchantName}
                placeholder="Store name"
                onCommit={onNameCommit}
                className={cn(
                  'min-w-0 flex-1 font-black tracking-tight',
                  compactMobile ? 'text-base lg:text-3xl' : 'text-2xl sm:text-3xl',
                )}
              />
            ) : (
              <h1
                className={cn(
                  'truncate font-black tracking-tight',
                  compactMobile ? 'text-base lg:text-3xl' : 'text-2xl sm:text-3xl',
                )}
              >
                {merchantName || 'Split it'}
              </h1>
            )}
            <Badge
              className={compactMobile ? 'hidden lg:inline-flex' : undefined}
              variant={status === 'FINALIZED' ? 'secondary' : 'outline'}
            >
              {statusLabel(status)}
            </Badge>
          </div>
          <p
            className={cn(
              'mt-0.5 text-sm text-muted-foreground',
              compactMobile && 'hidden lg:block',
            )}
          >
            {description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {trailing}
        {status === 'PUBLISHED' ? (
          <span
            className={cn(
              'items-center gap-1.5 rounded-full bg-success-subtle px-3 py-1.5 text-xs font-semibold text-success-subtle-foreground ring-1 ring-success/20',
              compactMobile ? 'hidden lg:inline-flex' : 'inline-flex',
            )}
          >
            <span className="size-2 animate-pulse rounded-full bg-success" />
            Link live
          </span>
        ) : null}
        {rate && displayToggle ? (
          <button
            type="button"
            onClick={cycleDisplay}
            aria-label={`${DISPLAY_LABEL[display]} — tap to change`}
            title={`${DISPLAY_LABEL[display]} — tap to change`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-strong transition-transform active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RiExchangeDollarLine
              className={cn('size-4', compactMobile && 'hidden lg:block')}
            />
            <span className={cn('tabular-nums', compactMobile && 'hidden lg:inline')}>
              $1 = {formatLbp(rate)}
            </span>
            {/* All three labels stay stacked in one cell so the chip (and the
                pill) never changes width mid-cycle — same crossfade as prices. */}
            <span className="grid justify-items-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold tabular-nums *:col-start-1 *:row-start-1">
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
        {/* A separate target, not a nested one: cycling the display and editing
            the rate are different intents and must not share a hit area. */}
        {onRateEdit ? (
          <button
            type="button"
            onClick={onRateEdit}
            aria-label="Edit the exchange rate"
            title="Edit the exchange rate"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-strong transition-transform active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RiEditLine className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}
