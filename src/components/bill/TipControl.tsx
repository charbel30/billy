import { AnimatedAmount } from '~/components/bill/AnimatedAmount'
import { formatUsd, toUsd } from '~/lib/currency'
import { cn } from '~/lib/utils'

const PRESETS = [0, 5, 10, 15, 20]

// Bill-level tip picker — one compact row of preset chips with a live preview
// of the tip in USD. Host-only (guests never see it); the value writes through
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
  const options = PRESETS.includes(value)
    ? PRESETS
    : [...PRESETS, value].sort((a, b) => a - b)

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-bold text-muted-foreground">
        Tip
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums transition-[background-color,color,transform] active:scale-[0.96] disabled:opacity-60',
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
      {tipLbp > 0 ? (
        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
          ≈{' '}
          <AnimatedAmount value={toUsd(tipLbp, rate)} format={formatUsd} />
        </span>
      ) : null}
    </div>
  )
}
