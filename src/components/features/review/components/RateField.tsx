import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiExchangeDollarLine } from '@remixicon/react'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { sheetSpring } from '~/lib/ui'
import { formatLbpCompact } from '~/lib/format'

// The USD↔LBP rate defaults to 90,000 and is correct ~95% of the time, so it's
// hidden behind a disclosure — only surface the editor when the venue actually
// charged a different rate.
export function RateField({
  rate,
  onCommit,
  readOnly = false,
}: {
  rate: number | null | undefined
  onCommit: (raw: string) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary-strong">
        <RiExchangeDollarLine className="size-4" />
        <span className="font-receipt tabular-nums">
          1 USD = {formatLbpCompact(rate ?? 0)}
        </span>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!open ? (
        <motion.button
          key="chip"
          type="button"
          onClick={() => setOpen(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={sheetSpring}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          <RiExchangeDollarLine className="size-4" />
          <span className="font-receipt">1 USD = {formatLbpCompact(rate ?? 0)}</span>
        </motion.button>
      ) : (
        <motion.div
          key="editor"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={sheetSpring}
          className="overflow-hidden rounded-control bg-muted/70"
        >
          <div className="p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Exchange rate (LL per $1)
            </p>
            <BlurCommitInput
              value={rate}
              numeric
              placeholder="90,000"
              onCommit={onCommit}
              align="center"
              className="mt-1 w-full rounded-control border border-border bg-background py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Only change this if the venue used a different rate.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
