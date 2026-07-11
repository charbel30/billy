import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'
import { swap } from '~/lib/ui'
import { cn } from '~/lib/utils'

// Shows the line price in USD; tapping flips it to LBP for ~1.6s, then reverts —
// dual-currency on demand without spending a permanent second line per card.
export function ItemPrice({
  lbp,
  rate,
  done,
}: {
  lbp: number
  rate: number | null | undefined
  done: boolean
}) {
  const [showLbp, setShowLbp] = useState(false)

  useEffect(() => {
    if (!showLbp) return
    const t = setTimeout(() => setShowLbp(false), 1600)
    return () => clearTimeout(t)
  }, [showLbp])

  return (
    <button
      type="button"
      onClick={() => setShowLbp((v) => !v)}
      aria-label="Show price in Lebanese pounds"
      className="text-right transition-transform active:scale-[0.96]"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {showLbp ? (
          <motion.span
            key="lbp"
            {...swap}
            className={cn(
              'block whitespace-nowrap font-receipt font-bold tracking-tight',
              done ? 'text-sm text-muted-foreground' : 'text-base text-foreground',
            )}
          >
            {formatLbp(lbp)}
          </motion.span>
        ) : (
          <motion.span
            key="usd"
            {...swap}
            className={cn(
              'block font-receipt font-bold tracking-tight',
              done ? 'text-sm text-muted-foreground' : 'text-lg text-primary-strong',
            )}
          >
            {formatUsd(toUsd(lbp, rate))}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
