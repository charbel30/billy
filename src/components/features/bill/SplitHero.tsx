import { motion } from 'motion/react'
import type { Claim, LineItem } from '~/lib/types'
import { effectiveUnitPrice, totalRemainingLbp } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { AnimatedAmount } from '~/components/ui/animated-amount'

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
    <section className="rounded-card border border-primary/15 bg-primary/[0.06] p-5 shadow-card sm:p-6">
      <p
        className={
          done
            ? 'text-xs font-semibold uppercase tracking-widest text-success-subtle-foreground'
            : 'text-xs font-semibold uppercase tracking-widest text-primary-strong/70'
        }
      >
        {done ? 'All assigned 🎉' : 'Remaining to split'}
      </p>
      <AnimatedAmount
        value={toUsd(remaining, rate)}
        format={formatUsd}
        className="mt-1 block font-receipt text-5xl font-bold tracking-tight text-primary-strong"
      />
      <AnimatedAmount
        value={remaining}
        format={formatLbp}
        className="mt-0.5 block font-receipt text-sm font-semibold text-primary-strong/60"
      />

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className={done ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-primary'}
          animate={{ width: `${claimedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">
          Total bill{' '}
          <span className="font-receipt text-foreground">
            {formatUsd(toUsd(total, rate))}
          </span>
        </span>
        <span className="font-receipt text-muted-foreground">
          {Math.round(claimedPct)}% claimed
        </span>
      </div>
    </section>
  )
}
