import { CurrencyAmount } from '../receipt/CurrencyAmount'
import { TIP_PRESETS } from '~/lib/bill'
import { cn } from '~/lib/utils'

// Bill-level tip picker — one compact row of preset chips with a live preview
// of the tip in the selected currency. Host-only (guests never see it); the value writes through
// the dedicated setTipPercent mutation, never saveWorking.
export function TipControl({
  value,
  onChange,
  pending = false,
  tipLbp,
  rate,
}: {
  value: number
  onChange: (pct: number) => void
  pending?: boolean
  /** Current total tip in LBP (Σ tipShareLbp) — the "≈ $X" preview. */
  tipLbp: number
  rate?: number | null
}) {
  // A non-preset value (legacy 0 is a preset; a future custom %) still shows
  // as its own chip — the current state is never invisible.
  const options = TIP_PRESETS.includes(value)
    ? TIP_PRESETS
    : [...TIP_PRESETS, value].sort((a, b) => a - b)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="shrink-0 text-xs font-bold text-muted-foreground">
          Tip
        </span>
        <span className="text-xs text-muted-foreground">
          {tipLbp > 0 ? (
            <CurrencyAmount lbp={tipLbp} rate={rate} />
          ) : (
            'No tip added'
          )}
        </span>
      </div>
      <div
        role="group"
        aria-label="Tip percentage"
        className="grid grid-cols-5 gap-1.5"
      >
        {options.map((pct) => {
          const selected = pct === value
          return (
            <button
              key={pct}
              type="button"
              disabled={pending}
              onClick={() => !selected && onChange(pct)}
              aria-pressed={selected}
              className={cn(
                'min-h-11 min-w-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring px-1 py-1 text-xs font-bold tabular-nums transition-[background-color,color,scale] active:scale-[0.96] disabled:opacity-60',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground ring-1 ring-border/50 hover:bg-muted hover:text-foreground',
              )}
            >
              {pct === 0 ? 'None' : `${pct}%`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
