import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'
import { crossfadeHidden, crossfadeShown, crossfadeSpring } from '~/lib/ui'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import { cn } from '~/lib/utils'


export function ItemPrice({
  lbp,
  rate,
  done,
}: {
  lbp: number
  rate: number | null | undefined
  done: boolean
}) {
  const { display } = useCurrencyDisplay()
  const lbpPrimary = display === 'lbp'
  const [flashed, setFlashed] = useState(false)

  useEffect(() => {
    if (!flashed) return
    const t = setTimeout(() => setFlashed(false), 1600)
    return () => clearTimeout(t)
  }, [flashed])

  // Flashing shows the currency opposite to the current primary.
  const showLbp = lbpPrimary !== flashed
  const showMicro = display === 'both' && !flashed

  const fade = (shown: boolean) => ({
    initial: false as const,
    animate: shown ? crossfadeShown : crossfadeHidden,
    transition: crossfadeSpring,
  })

  return (
    <button
      type="button"
      onClick={() => setFlashed((v) => !v)}
      aria-label={
        lbpPrimary ? 'Show price in US dollars' : 'Show price in Lebanese pounds'
      }
      className="text-right transition-transform active:scale-[0.96]"
    >
      <span className="grid justify-items-end [&>*]:col-start-1 [&>*]:row-start-1">
        <motion.span
          aria-hidden={!showLbp}
          {...fade(showLbp)}
          className={cn(
            'whitespace-nowrap font-receipt font-bold tracking-tight',
            done
              ? 'text-sm leading-5 text-muted-foreground'
              : cn(
                  'text-base leading-7',
                  lbpPrimary ? 'text-primary-strong' : 'text-foreground',
                ),
          )}
        >
          {formatLbp(lbp)}
        </motion.span>
        <motion.span
          aria-hidden={showLbp}
          {...fade(!showLbp)}
          className={cn(
            'font-receipt font-bold tracking-tight',
            done
              ? 'text-sm leading-5 text-muted-foreground'
              : 'text-lg leading-7 text-primary-strong',
          )}
        >
          {formatUsd(toUsd(lbp, rate))}
        </motion.span>
      </span>
      {done ? null : (
        <motion.span
          aria-hidden={!showMicro}
          {...fade(showMicro)}
          className="block whitespace-nowrap font-receipt text-[10px] font-semibold tabular-nums text-muted-foreground"
        >
          {formatLbp(lbp)}
        </motion.span>
      )}
    </button>
  )
}
