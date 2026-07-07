import { motion } from 'motion/react'
import { RiCheckLine } from '@remixicon/react'
import type { Portfolio, ClaimedLine } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { formatUnits } from '~/lib/format'
import { ELEVATED_CARD } from '~/lib/bill/constants'
import { itemEmoji } from '~/lib/bill/itemEmoji'
import { tapHaptic } from '~/lib/haptics'
import { cn } from '~/lib/utils'
import { PersonAvatar } from './PersonAvatar'

// One person's slice of the bill, rendered like their own little receipt
// (ui-flow-vision.md): their lines, then a USD headline total with LBP under it.
export function PortfolioReceipt({
  portfolio,
  lines,
  rate,
  serviceChargeOn,
  tipPercent,
  bare = false,
  paidAt,
  onTogglePaid,
  togglePending = false,
}: {
  portfolio: Portfolio
  lines: ClaimedLine[]
  rate: number | null | undefined
  serviceChargeOn: boolean
  /** Bill-level tip percent — only used for the tip line's label. */
  tipPercent?: number | null
  // `bare` drops the card chrome for embedding inside a popover / sheet that
  // already provides its own surface.
  bare?: boolean
  // Mark-as-paid: when set, shows a "Paid ✓" chip. With `onTogglePaid` the
  // chip becomes an interactive "Mark paid" ↔ "Paid ✓" toggle.
  paidAt?: number
  onTogglePaid?: (paid: boolean) => void
  togglePending?: boolean
}) {
  const paid = paidAt != null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        !bare && cn('p-4 transition-colors', ELEVATED_CARD),
        !bare && paid && 'bg-success-subtle/50',
      )}
    >
      <div className="flex items-center gap-2">
        <PersonAvatar name={portfolio.name} color={portfolio.color} size="sm" />
        <span className="truncate font-bold">{portfolio.name}</span>
        {onTogglePaid ? (
          <button
            type="button"
            disabled={togglePending}
            onClick={() => {
              tapHaptic()
              onTogglePaid(!paid)
            }}
            className={cn(
              'ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-[background-color,color,transform] active:scale-[0.96] disabled:opacity-50',
              paid
                ? 'bg-success-subtle text-success-subtle-foreground'
                : 'bg-muted text-muted-foreground hover:bg-success-subtle hover:text-success-subtle-foreground',
            )}
          >
            {paid ? (
              <>
                Paid <RiCheckLine className="size-3.5" />
              </>
            ) : (
              'Mark paid'
            )}
          </button>
        ) : paid ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-success-subtle px-2.5 py-1 text-xs font-bold text-success-subtle-foreground">
            Paid <RiCheckLine className="size-3.5" />
          </span>
        ) : null}
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <div className="space-y-1 text-sm">
        {lines.map((l) => {
          const emoji = itemEmoji(l.name)
          return (
            <div key={l.itemId} className="flex justify-between gap-2 font-receipt">
              <span className="truncate text-muted-foreground">
                {formatUnits(l.units)}× {emoji ? <span aria-hidden>{emoji} </span> : null}
                {l.name}
              </span>
              <span>{formatUsd(toUsd(l.lbp, rate))}</span>
            </div>
          )
        })}
        {lines.length === 0 && (
          <div className="text-sm text-muted-foreground">Nothing claimed yet</div>
        )}
      </div>

      {serviceChargeOn && portfolio.serviceShareLbp !== 0 && (
        <div className="mt-1 flex justify-between font-receipt text-xs text-muted-foreground">
          <span>service &amp; tax</span>
          <span>{formatUsd(toUsd(portfolio.serviceShareLbp, rate))}</span>
        </div>
      )}

      {portfolio.tipShareLbp !== 0 && (
        <div className="mt-1 flex justify-between font-receipt text-xs text-muted-foreground">
          <span>tip{tipPercent ? ` (${tipPercent}%)` : ''}</span>
          <span>{formatUsd(toUsd(portfolio.tipShareLbp, rate))}</span>
        </div>
      )}

      <div className="my-3 border-t border-dashed border-border" />

      <div className="flex items-end justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <div className="text-right">
          <div className="font-receipt text-2xl font-bold tracking-tight text-primary-strong">
            {formatUsd(toUsd(portfolio.totalLbp, rate))}
          </div>
          <div className="font-receipt text-xs text-muted-foreground">
            {formatLbp(portfolio.totalLbp)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
