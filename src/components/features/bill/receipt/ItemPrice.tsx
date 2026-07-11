import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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

  const primaryText = lbpPrimary ? formatLbp(lbp) : formatUsd(toUsd(lbp, rate))
  const flashText = lbpPrimary ? formatUsd(toUsd(lbp, rate)) : formatLbp(lbp)
  const showMicro = display === 'both'

  return (
    <button
      type="button"
      onClick={() => setFlashed((v) => !v)}
      aria-label={
        lbpPrimary ? 'Show price in US dollars' : 'Show price in Lebanese pounds'
      }
      className="relative text-right transition-transform active:scale-[0.96]"
    >
      {/* Primary price at full size, natural width — no reserved space for the
          hidden currency. Cycling the mode reflows the card once (animated by
          the card's layout wrappers); that's rarer and cheaper than shrinking
          every price to fit the widest LBP string. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={lbpPrimary ? 'lbp' : 'usd'}
          initial={crossfadeHidden}
          animate={flashed ? crossfadeHidden : crossfadeShown}
          exit={crossfadeHidden}
          transition={crossfadeSpring}
          className={cn(
            'block whitespace-nowrap font-receipt font-bold tracking-tight',
            done
              ? 'text-sm leading-5 text-muted-foreground'
              : 'text-lg leading-7 text-primary-strong',
          )}
        >
          {primaryText}
        </motion.span>
      </AnimatePresence>

      {/* Tap-flash: the other currency floats over the price as a chip. It's
          the per-tap hot path, so it never enters the layout — a mount/unmount
          here made every `layout` card ripple and the fixed dock repaint. */}
      <AnimatePresence initial={false}>
        {flashed ? (
          <motion.span
            key="flash"
            initial={crossfadeHidden}
            animate={crossfadeShown}
            exit={crossfadeHidden}
            transition={crossfadeSpring}
            className="pointer-events-none absolute right-0 top-0 z-10 whitespace-nowrap rounded-md bg-popover px-1.5 py-0.5 font-receipt text-sm font-bold tracking-tight text-foreground shadow-md ring-1 ring-border"
          >
            {flashText}
          </motion.span>
        ) : null}
      </AnimatePresence>

      {done ? null : (
        <motion.span
          aria-hidden={!showMicro}
          initial={false}
          animate={showMicro ? crossfadeShown : crossfadeHidden}
          transition={crossfadeSpring}
          className="block whitespace-nowrap font-receipt text-[10px] font-semibold tabular-nums text-muted-foreground"
        >
          {formatLbp(lbp)}
        </motion.span>
      )}
    </button>
  )
}
