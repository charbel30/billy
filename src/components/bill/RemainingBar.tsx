import { motion } from 'motion/react'
import type { Claim, LineItem } from '~/lib/types'
import { effectiveUnitPrice, totalRemainingLbp } from '~/lib/split'
import { formatLbp } from '~/lib/currency'
import { AnimatedAmount } from './AnimatedAmount'

// The "remaining on the bill" running total + bar (ui-flow-vision.md). Shrinks as
// units are claimed; reaches empty when the whole receipt is assigned.
export function RemainingBar({
  lineItems,
  claims,
}: {
  lineItems: LineItem[]
  claims: Claim[]
}) {
  const total = lineItems.reduce(
    (s, item) => s + item.qty * effectiveUnitPrice(item),
    0,
  )
  const remaining = totalRemainingLbp(lineItems, claims)
  const claimedPct = total > 0 ? ((total - remaining) / total) * 100 : 0
  const done = remaining <= 0.5

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {done ? 'All assigned 🎉' : 'Remaining on the bill'}
        </span>
        <AnimatedAmount
          value={remaining}
          format={formatLbp}
          className="font-semibold"
        />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${claimedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}
