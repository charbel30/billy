import { useState } from 'react'
import { RiExchangeDollarLine } from '@remixicon/react'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatLbpCompact } from '~/lib/format'

// The USD↔LBP rate defaults to 90,000 and is correct ~95% of the time, so it's
// hidden behind a disclosure — only surface the editor when the venue actually
// charged a different rate.
export function RateField({
  rate,
  onCommit,
}: {
  rate: number | null | undefined
  onCommit: (raw: string) => void
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        <RiExchangeDollarLine className="size-4" />
        <span className="tabular-nums">1 USD = {formatLbpCompact(rate ?? 0)}</span>
      </button>
    )
  }

  return (
    <div className="rounded-3xl bg-muted/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Exchange rate (LL per $1)
      </p>
      <BlurCommitInput
        value={rate}
        numeric
        placeholder="90,000"
        onCommit={onCommit}
        align="center"
        className="mt-1 w-full rounded-2xl border border-border bg-background py-2 text-sm tabular-nums"
      />
      <p className="text-xs text-muted-foreground">
        Only change this if the venue used a different rate.
      </p>
    </div>
  )
}
