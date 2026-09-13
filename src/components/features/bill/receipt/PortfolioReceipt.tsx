import { motion } from 'motion/react'
import { RiCheckLine, RiSendPlaneLine } from '@remixicon/react'
import type { Portfolio, ClaimedLine } from '~/lib/money'
import { CurrencyAmount } from './CurrencyAmount'
import { formatUnits } from '~/lib/format'
import { ELEVATED_CARD, itemEmoji } from '~/lib/bill'
import { tapHaptic, sheetSpring } from '~/lib/ui'
import { cn } from '~/lib/utils'
import { PersonAvatar } from '../people/PersonAvatar'

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
  onSend,
  sendPending = false,
  sendLabel,
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
  onSend?: () => void
  sendPending?: boolean
  sendLabel?: string
}) {
  const paid = paidAt != null

  return (
    <motion.div
      layout
      transition={sheetSpring}
      initial={bare ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        !bare && cn('p-4 transition-colors', ELEVATED_CARD),
        !bare && paid && 'bg-success-subtle/50',
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <PersonAvatar name={portfolio.name} color={portfolio.color} size="sm" />
        <span className="min-w-0 flex-1 break-words font-bold">
          {portfolio.name}
        </span>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-1">
          {onSend ? (
            <button
              type="button"
              disabled={sendPending}
              onClick={() => {
                tapHaptic()
                onSend()
              }}
              aria-label={sendLabel ?? 'Send'}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-bold text-primary-strong transition-[background-color,scale] hover:bg-primary/10 active:scale-[0.96] disabled:opacity-50"
            >
              <RiSendPlaneLine className="size-4" aria-hidden />
              Send
            </button>
          ) : null}
          {onTogglePaid ? (
            <button
              type="button"
              disabled={togglePending}
              onClick={() => {
                tapHaptic()
                onTogglePaid(!paid)
              }}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-[background-color,color,scale] active:scale-[0.96] disabled:opacity-50',
                paid
                  ? 'bg-success-subtle text-success-subtle-foreground'
                  : 'bg-primary/10 text-primary-strong ring-1 ring-primary/20 hover:bg-success-subtle hover:text-success-subtle-foreground',
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
            <span className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-success-subtle px-2.5 text-xs font-bold text-success-subtle-foreground">
              Paid <RiCheckLine className="size-3.5" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <div className="space-y-1 text-sm">
        {lines.map((l) => {
          const emoji = itemEmoji(l.name)
          return (
            <div
              key={l.itemId}
              className="flex items-start justify-between gap-3"
            >
              <span className="min-w-0 break-words text-muted-foreground">
                {formatUnits(l.units)}×{' '}
                {emoji ? <span aria-hidden>{emoji} </span> : null}
                {l.name}
              </span>
              <CurrencyAmount lbp={l.lbp} rate={rate} className="shrink-0" />
            </div>
          )
        })}
        {lines.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Nothing claimed yet
          </div>
        )}
      </div>

      {serviceChargeOn && portfolio.serviceShareLbp !== 0 && (
        <div className="mt-1 flex justify-between font-receipt text-xs text-muted-foreground">
          <span>service &amp; tax</span>
          <CurrencyAmount lbp={portfolio.serviceShareLbp} rate={rate} />
        </div>
      )}

      {portfolio.tipShareLbp !== 0 && (
        <div className="mt-1 flex justify-between font-receipt text-xs text-muted-foreground">
          <span>tip{tipPercent ? ` (${tipPercent}%)` : ''}</span>
          <CurrencyAmount lbp={portfolio.tipShareLbp} rate={rate} />
        </div>
      )}

      <div className="my-3 border-t border-dashed border-border" />

      <div className="flex items-end justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <div className="text-right">
          <CurrencyAmount
            lbp={portfolio.totalLbp}
            usd={portfolio.totalUsd}
            rate={rate}
            secondary
            className="block break-words text-2xl font-bold tracking-tight text-primary-strong"
          />
        </div>
      </div>
    </motion.div>
  )
}
