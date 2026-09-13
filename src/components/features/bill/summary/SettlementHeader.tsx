import { motion, useReducedMotion } from 'motion/react'
import { RiCheckLine } from '@remixicon/react'
import { CurrencyAmount } from '../receipt/CurrencyAmount'
import { pillSpring, popIn } from '~/lib/ui'
import type { SettlementProgress } from '~/lib/bill'
import { cn } from '~/lib/utils'

const DEFAULT_LABELS = {
  allSettled: 'All settled',
  progress: (settled: number, total: number) =>
    `${settled} of ${total} settled`,
  outstanding: 'Outstanding',
}

export function SettlementHeader({
  progress,
  travelTotal = true,
  rate,
  labels = DEFAULT_LABELS,
}: {
  rate?: number | null
  progress: SettlementProgress
  /** Exactly one visible `bill-total` per screen — the main column, not the aside. */
  travelTotal?: boolean
  labels?: {
    allSettled: string
    progress: (settled: number, total: number) => string
    outstanding: string
  }
}) {
  const reduceMotion = useReducedMotion()
  const { settled, total, outstandingLbp, outstandingUsd } = progress
  const allSettled = total > 0 && settled === total
  const fraction = total > 0 ? settled / total : 0
  const percent = Math.round(fraction * 100)

  return (
    <section
      aria-label="Settlement progress"
      className={cn(
        'space-y-3 overflow-hidden rounded-card border p-5 shadow-card transition-colors duration-200 sm:p-6 motion-reduce:transition-none',
        allSettled
          ? 'border-success/20 bg-success-subtle/50'
          : 'border-primary/20 bg-primary/[0.07]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'flex items-center gap-1.5 text-sm font-bold',
            allSettled
              ? 'text-success-subtle-foreground'
              : 'text-primary-strong',
          )}
        >
          {allSettled ? (
            <motion.span {...popIn} className="inline-flex">
              <RiCheckLine className="size-4" aria-hidden />
            </motion.span>
          ) : null}
          {allSettled ? labels.allSettled : labels.progress(settled, total)}
        </p>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 font-receipt text-xs font-bold tabular-nums text-primary-strong">
          {percent}%
        </span>
      </div>

      <div
        style={travelTotal ? { viewTransitionName: 'bill-total' } : undefined}
      >
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {labels.outstanding}
        </p>
        <CurrencyAmount
          lbp={outstandingLbp}
          usd={outstandingUsd}
          rate={rate}
          secondary
          className={cn(
            'mt-1 block break-words text-[clamp(1.75rem,8vw,3rem)] font-bold leading-tight tracking-tight',
            allSettled
              ? 'text-success-subtle-foreground'
              : 'text-primary-strong',
          )}
        />
      </div>

      <div
        role="progressbar"
        aria-label="People settled"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={labels.progress(settled, total)}
        className="h-3 overflow-hidden rounded-full bg-foreground/10 shadow-inner"
      >
        <motion.div
          initial={false}
          animate={{ scaleX: fraction }}
          transition={reduceMotion ? { duration: 0 } : pillSpring}
          className={cn(
            'h-full w-full origin-left rounded-full rtl:origin-right',
            allSettled ? 'bg-success' : 'bg-primary',
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {allSettled
          ? 'Everyone has paid their share.'
          : total === 0
            ? 'No payments to collect yet.'
            : `${total - settled} ${total - settled === 1 ? 'person still needs' : 'people still need'} to pay.`}
      </p>
    </section>
  )
}
