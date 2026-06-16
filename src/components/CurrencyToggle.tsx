import { cn } from '~/lib/utils'

export type Currency = 'LBP' | 'USD'

// Segmented LBP/USD switch for amount displays (spec §8.2 CurrencyToggle).
export function CurrencyToggle({
  value,
  onChange,
  className,
}: {
  value: Currency
  onChange: (c: Currency) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-3xl border border-border p-0.5', className)}>
      {(['LBP', 'USD'] as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'px-3 py-1 text-sm rounded-3xl transition-colors',
            value === c
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
