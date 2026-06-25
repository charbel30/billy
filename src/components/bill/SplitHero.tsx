import { motion } from 'motion/react'
import type { Claim, LineItem } from '~/lib/types'
import { effectiveUnitPrice, totalRemainingLbp } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { AnimatedAmount } from './AnimatedAmount'

// The "remaining to split" hero (ui-flow-vision.md). A big USD figure with the
// LBP underneath, the total bill alongside, and a progress bar that shrinks as
// units get claimed — reaching empty when the whole receipt is assigned.
export function SplitHero({
  lineItems,
  claims,
  rate,
}: {
  lineItems: LineItem[]
  claims: Claim[]
  rate: number | null | undefined
}) {
  const total = lineItems.reduce(
    (s, item) => s + item.qty * effectiveUnitPrice(item),
    0,
  )
  const remaining = totalRemainingLbp(lineItems, claims)
  const claimedPct = total > 0 ? ((total - remaining) / total) * 100 : 0
  const done = remaining <= 0.5

  return (
    <section className="rounded-4xl bg-muted/80 p-5 shadow-[0_18px_56px_rgba(0,0,0,0.06)] ring-1 ring-border/40 backdrop-blur sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {done ? 'All assigned 🎉' : 'Remaining to split'}
          </p>
          <AnimatedAmount
            value={toUsd(remaining, rate)}
            format={formatUsd}
            className="mt-1 block text-4xl font-black tracking-tight text-primary sm:text-5xl"
          />
          <AnimatedAmount
            value={remaining}
            format={formatLbp}
            className="mt-1 block text-sm font-semibold text-primary/70"
          />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-muted-foreground">Total bill</p>
          <AnimatedAmount
            value={toUsd(total, rate)}
            format={formatUsd}
            className="mt-1 block text-lg font-black tracking-tight tabular-nums"
          />
          <AnimatedAmount
            value={total}
            format={formatLbp}
            className="block text-xs font-semibold text-muted-foreground"
          />
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/70">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${claimedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </section>
  )
}
