import { motion } from 'motion/react'
import type { Portfolio, ClaimedLine } from '~/lib/split'
import type { Currency } from '~/components/CurrencyToggle'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { formatUnits } from '~/lib/format'

// One person's slice of the bill, rendered like their own little receipt
// (ui-flow-vision.md): their lines, then a USD headline total with LBP under it.
export function PortfolioReceipt({
  portfolio,
  lines,
  rate,
  currency,
  serviceChargeOn,
}: {
  portfolio: Portfolio
  lines: ClaimedLine[]
  rate: number | null | undefined
  currency: Currency
  serviceChargeOn: boolean
}) {
  const fmt = (lbp: number) =>
    currency === 'LBP' ? formatLbp(lbp) : formatUsd(toUsd(lbp, rate))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: portfolio.color }}
        />
        <span className="font-bold">{portfolio.name}</span>
      </div>

      <div className="my-3 border-t border-dashed border-border" />

      <div className="space-y-1 text-sm">
        {lines.map((l) => (
          <div key={l.itemId} className="flex justify-between gap-2 tabular-nums">
            <span className="truncate text-muted-foreground">
              {formatUnits(l.units)}× {l.name}
            </span>
            <span>{fmt(l.lbp)}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="text-sm text-muted-foreground">Nothing claimed yet</div>
        )}
      </div>

      {serviceChargeOn && portfolio.serviceShareLbp !== 0 && (
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>service &amp; tax</span>
          <span>{fmt(portfolio.serviceShareLbp)}</span>
        </div>
      )}

      <div className="my-3 border-t border-dashed border-border" />

      <div className="flex items-end justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <div className="text-right">
          <div className="text-2xl font-black">
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
