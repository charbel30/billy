import { AnimatePresence, motion } from 'motion/react'
import { RiAddLine, RiAlertLine, RiDeleteBin6Line } from '@remixicon/react'
import type { LineItem } from '~/lib/types'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'
import { LOW_CONFIDENCE_THRESHOLD } from '~/lib/bill'
import { parseNumericInput } from '~/lib/format'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'

// A receipt-style line list with inline editing on the RIGHT of each row
// (ui-flow-vision.md). lineTotal is the source of truth; editing qty or unit price
// recomputes it, but editing the total directly overrides it.

export function ReceiptLines({
  lineItems,
  rate,
  onUpdate,
  onRemove,
  onAdd,
}: {
  lineItems: LineItem[]
  rate: number | null | undefined
  onUpdate: (id: string, patch: Partial<LineItem>) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="divide-y divide-dashed divide-border">
      <AnimatePresence initial={false}>
        {lineItems.map((li) => {
          const low =
            li.confidence != null && li.confidence < LOW_CONFIDENCE_THRESHOLD
          return (
            <motion.div
              key={li.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="py-2"
            >
              <div className="flex items-baseline gap-2">
                <BlurCommitInput
                  value={li.name}
                  placeholder="Item"
                  onCommit={(raw) => onUpdate(li.id, { name: raw })}
                  className="flex-1 -mx-1 font-medium"
                />
                <span className="font-receipt font-semibold">
                  {formatLbp(li.lineTotal)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {low && (
                  <span
                    title="Low confidence — check this line"
                    className="inline-flex items-center gap-0.5 text-warning-subtle-foreground"
                  >
                    <RiAlertLine className="size-3.5" /> check
                  </span>
                )}
                <BlurCommitInput
                  value={li.qty}
                  numeric
                  onCommit={(raw) => {
                    const qty = parseNumericInput(raw)
                    onUpdate(li.id, { qty, lineTotal: qty * li.unitPrice })
                  }}
                  align="center"
                  className="w-10 -mx-1"
                />
                <span>×</span>
                <BlurCommitInput
                  value={li.unitPrice}
                  numeric
                  onCommit={(raw) => {
                    const unitPrice = parseNumericInput(raw)
                    onUpdate(li.id, { unitPrice, lineTotal: li.qty * unitPrice })
                  }}
                  className="w-20 -mx-1"
                />
                <span className="ml-auto flex items-center gap-2">
                  {rate ? <span>{formatUsd(toUsd(li.lineTotal, rate))}</span> : null}
                  <button
                    type="button"
                    onClick={() => onRemove(li.id)}
                    className="grid size-9 place-items-center rounded-full text-muted-foreground hover:text-destructive transition-[scale,color] active:scale-[0.96]"
                    aria-label="Remove item"
                  >
                    <RiDeleteBin6Line className="size-4" />
                  </button>
                </span>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1 py-3 text-sm text-muted-foreground hover:text-foreground transition-[scale,color] active:scale-[0.96]"
      >
        <RiAddLine className="size-4" /> Add item
      </button>
    </div>
  )
}
