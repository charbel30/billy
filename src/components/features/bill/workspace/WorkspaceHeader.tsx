import type { ComponentType } from 'react'
import { RiExchangeDollarLine, RiGroupLine } from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatLbp } from '~/lib/money'
import { statusLabel } from '~/lib/bill'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import { nextCurrencyDisplay, type CurrencyDisplay } from '~/lib/session'
import type { BillStatus } from '~/lib/types'

const DISPLAY_LABEL: Record<CurrencyDisplay, string> = {
  both: 'USD + LBP',
  usd: 'USD',
  lbp: 'LBP',
}

// Mobile keeps the merchant and currency together in one row. Supporting
// context stays in the desktop header; review edits the name in place.
export function WorkspaceHeader({
  merchantName,
  status,
  rate,
  description,
  icon: Icon = RiGroupLine,
  onNameCommit,
  displayToggle = true,
}: {
  merchantName: string
  status: BillStatus
  rate: number | null | undefined
  description: string
  icon?: ComponentType<{ className?: string }>
  onNameCommit?: (name: string) => void
  displayToggle?: boolean
}) {
  const { display, cycleDisplay } = useCurrencyDisplay()
  const currencyLabel = `Prices in ${DISPLAY_LABEL[display]}. Tap to show ${DISPLAY_LABEL[nextCurrencyDisplay(display)]}`

  return (
    <div className="flex items-center justify-between gap-3 lg:flex-wrap lg:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3 lg:min-w-64">
        <div className="hidden size-11 shrink-0 place-items-center rounded-control bg-primary/10 text-primary-strong lg:grid">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {onNameCommit ? (
              <label className="min-w-0 flex-1">
                <span className="sr-only">Store name</span>
                <BlurCommitInput
                  value={merchantName}
                  placeholder="Store name"
                  onCommit={onNameCommit}
                  className="min-h-11 w-full min-w-0 px-0 text-base font-black tracking-tight lg:px-1 lg:text-3xl"
                />
              </label>
            ) : (
              <h1 className="min-w-0 break-words text-base font-black tracking-tight lg:text-3xl">
                {merchantName || 'Split it'}
              </h1>
            )}
            <Badge
              className="hidden lg:inline-flex"
              variant={status === 'FINALIZED' ? 'secondary' : 'outline'}
            >
              {statusLabel(status)}
            </Badge>
          </div>
          <p className="mt-0.5 hidden text-sm text-muted-foreground lg:block">
            {description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:flex-wrap lg:justify-end">
        {status === 'PUBLISHED' ? (
          <span className="hidden items-center gap-1.5 rounded-full bg-success-subtle px-3 py-1.5 text-xs font-semibold text-success-subtle-foreground ring-1 ring-success/20 lg:inline-flex">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            Link live
          </span>
        ) : null}
        {rate && displayToggle ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cycleDisplay}
              aria-label={currencyLabel}
              title={currencyLabel}
              className="inline-flex min-h-11 w-28 items-center justify-center gap-1.5 rounded-full bg-primary/10 px-2 text-xs font-bold text-primary-strong transition-[background-color,transform] hover:bg-primary/20 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <RiExchangeDollarLine className="size-4 shrink-0" aria-hidden />
              <span>{DISPLAY_LABEL[display]}</span>
            </button>
            <span className="hidden text-[11px] text-muted-foreground tabular-nums lg:inline">
              $1 = {formatLbp(rate)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
