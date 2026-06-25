import { motion } from 'motion/react'
import type { Claim, LineItem } from '~/lib/types'
import { effectiveUnitPrice, totalRemainingLbp } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { AnimatedAmount } from './AnimatedAmount'

// The "remaining to split" hero (ui-flow-vision.md). A bold, primary-tinted card
// so it reads as the focal point (not floating muted whitespace): the remaining
// figure leads, with the total bill + % claimed as an aligned footer row, and a
// progress bar that fills as the receipt gets assigned.
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
    <section className="rounded-4xl border border-primary/15 bg-primary/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_16px_44px_rgba(79,55,138,0.10)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
        {done ? 'All assigned 🎉' : 'Remaining to split'}
      </p>
      <AnimatedAmount
        value={toUsd(remaining, rate)}
        format={formatUsd}
        className="mt-1 block text-5xl font-black tracking-tight text-primary tabular-nums"
      />
      <AnimatedAmount
        value={remaining}
        format={formatLbp}
        className="mt-0.5 block text-sm font-semibold text-primary/60 tabular-nums"
      />

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${claimedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">
          Total bill{' '}
          <span className="text-foreground tabular-nums">
            {formatUsd(toUsd(total, rate))}
          </span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {Math.round(claimedPct)}% claimed
        </span>
      </div>
    </section>
  )
}
