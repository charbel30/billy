import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Claim, LineItem } from '~/lib/types'
import { effectiveUnitPrice, remainingUnits, totalRemainingLbp, formatLbp, formatUsd, toUsd } from '~/lib/money'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { RiCheckLine } from '@remixicon/react'
import { cn } from '~/lib/utils'

export function SplitHero({ lineItems, claims, rate, inviteAction }: {
  lineItems: LineItem[]
  claims: Claim[]
  rate: number | null | undefined
  inviteAction?: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const total = lineItems.reduce((sum, item) => sum + item.qty * effectiveUnitPrice(item), 0)
  const remaining = Math.max(0, totalRemainingLbp(lineItems, claims))
  const assigned = lineItems.filter((item) => remainingUnits(item, claims) <= 0.0001).length
  const done = lineItems.length > 0 && assigned === lineItems.length
  const fraction = total > 0 ? (total - remaining) / total : lineItems.length ? assigned / lineItems.length : 0
  const progress = Math.max(0, Math.min(1, done ? 1 : fraction))
  const percent = Math.round(progress * 100)
  const hasRate = rate != null && rate > 0

  return (
    <section aria-label="Split progress" className={cn('overflow-hidden rounded-card border p-5 shadow-card transition-colors duration-200 sm:p-6 motion-reduce:transition-none', done ? 'border-success/20 bg-success-subtle/50' : 'border-primary/20 bg-primary/[0.07]')}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn('flex items-center gap-1.5 text-sm font-bold', done ? 'text-success-subtle-foreground' : 'text-primary-strong')}>
          {done ? <RiCheckLine className="size-4" aria-hidden /> : null}
          {done ? 'Everyone’s items are assigned' : 'Remaining to split'}
        </p>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 font-receipt text-xs font-bold tabular-nums', done ? 'bg-success/15 text-success-subtle-foreground' : 'bg-primary/15 text-primary-strong')}>{percent}%</span>
      </div>
      <AnimatedAmount value={hasRate ? toUsd(remaining, rate) : remaining} format={hasRate ? formatUsd : formatLbp}
        className={cn('mt-2 block font-receipt text-[clamp(2rem,9vw,3rem)] font-bold leading-tight tracking-tight tabular-nums', done ? 'text-success-subtle-foreground' : 'text-primary-strong')} />
      {hasRate ? <AnimatedAmount value={remaining} format={formatLbp} className="mt-0.5 block font-receipt text-xs font-semibold text-muted-foreground" /> : null}
      <div role="progressbar" aria-label="Receipt items assigned" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        aria-valuetext={`${assigned} of ${lineItems.length} items fully assigned, ${percent}% of item value split`}
        className="mt-4 h-3 overflow-hidden rounded-full bg-foreground/10 shadow-inner">
        <motion.div initial={false} animate={{ scaleX: progress }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.4, bounce: 0 }}
          className={cn('h-full w-full origin-left rounded-full rtl:origin-right', done ? 'bg-success' : 'bg-primary')} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">{assigned} of {lineItems.length} items assigned</span>
        <span>Items total <span className="font-receipt font-semibold text-foreground">{hasRate ? formatUsd(toUsd(total, rate)) : formatLbp(total)}</span></span>
      </div>
      {inviteAction ? <div className="mt-4 border-t border-primary/15 pt-4">{inviteAction}</div> : null}
    </section>
  )
}
