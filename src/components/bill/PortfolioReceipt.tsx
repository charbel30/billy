import { motion } from 'motion/react'
import type { Portfolio, ClaimedLine } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { formatUnits } from '~/lib/format'
import { PersonAvatar } from './PersonAvatar'

// One person's slice of the bill, rendered like their own little receipt
// (ui-flow-vision.md): their lines, then a USD headline total with LBP under it.
export function PortfolioReceipt({
  portfolio,
  lines,
  rate,
  serviceChargeOn,
}: {
  portfolio: Portfolio
  lines: ClaimedLine[]
  rate: number | null | undefined
  serviceChargeOn: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-background/85 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)] ring-1 ring-border/35"
    >
      <div className="flex items-center gap-2">
        <PersonAvatar name={portfolio.name} color={portfolio.color} size="sm" />
        <span className="font-bold">{portfolio.name}</span>
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <div className="space-y-1 text-sm">
        {lines.map((l) => (
          <div key={l.itemId} className="flex justify-between gap-2 tabular-nums">
            <span className="truncate text-muted-foreground">
              {formatUnits(l.units)}× {l.name}
            </span>
            <span>{formatUsd(toUsd(l.lbp, rate))}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="text-sm text-muted-foreground">Nothing claimed yet</div>
        )}
      </div>

      {serviceChargeOn && portfolio.serviceShareLbp !== 0 && (
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>service &amp; tax</span>
          <span>{formatUsd(toUsd(portfolio.serviceShareLbp, rate))}</span>
        </div>
      )}

      <div className="my-3 border-t border-dashed border-border" />

      <div className="flex items-end justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <div className="text-right">
          <div className="text-2xl font-black tracking-tight text-primary">
            {formatUsd(toUsd(portfolio.totalLbp, rate))}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatLbp(portfolio.totalLbp)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
