import { motion, useReducedMotion } from 'motion/react'
import { RiCheckLine } from '@remixicon/react'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { formatLbp, formatUsd } from '~/lib/money'
import { pillSpring, popIn } from '~/lib/ui'
import type { SettlementProgress } from '~/lib/bill'
import { cn } from '~/lib/utils'

const DEFAULT_LABELS = {
  allSettled: 'All settled',
  progress: (settled: number, total: number) => `${settled} of ${total} settled`,
  outstanding: 'Outstanding',
}

export function SettlementHeader({
  progress,
  travelTotal = true,
  labels = DEFAULT_LABELS,
}: {
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
    <section aria-label="Settlement progress" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('flex items-center gap-1.5 text-sm font-bold', allSettled ? 'text-success-subtle-foreground' : 'text-primary-strong')}>
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

      <div style={travelTotal ? { viewTransitionName: 'bill-total' } : undefined}>
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {labels.outstanding}
        </p>
        <AnimatedAmount
          value={outstandingUsd}
          format={formatUsd}
          className="block font-receipt text-[clamp(2rem,9vw,3rem)] font-bold leading-tight tracking-tight text-primary-strong"
        />
        <AnimatedAmount
          value={outstandingLbp}
          format={formatLbp}
          className="mt-0.5 block font-receipt text-xs font-semibold text-muted-foreground"
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
    </section>
  )
}
