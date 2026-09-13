import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'
import { cn } from '~/lib/utils'
import { AnimatedAmount } from '~/components/ui/animated-amount'

/** Shared display preference; preserve apportioned USD cents when supplied. */
export function CurrencyAmount({
  lbp,
  usd,
  rate,
  className,
  secondary = false,
}: {
  lbp: number
  usd?: number
  rate?: number | null
  className?: string
  secondary?: boolean
}) {
  const { display } = useCurrencyDisplay()
  const pounds = display === 'lbp' || !rate || rate <= 0
  return (
    <span className={cn('font-receipt tabular-nums', className)}>
      <AnimatedAmount
        key={pounds ? 'lbp' : 'usd'}
        value={pounds ? lbp : (usd ?? toUsd(lbp, rate))}
        format={pounds ? formatLbp : formatUsd}
      />
      {secondary && display === 'both' && !pounds ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {formatLbp(lbp)}
        </span>
      ) : null}
    </span>
  )
}
