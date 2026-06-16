import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiAddLine, RiAlertLine, RiDeleteBin6Line } from '@remixicon/react'
import type { LineItem } from '~/lib/types'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { cn } from '~/lib/utils'

const LOW_CONFIDENCE = 0.6

// A receipt-style line list with inline editing on the RIGHT of each row
// (ui-flow-vision.md). lineTotal is the source of truth; editing qty or unit price
// recomputes it, but editing the total directly overrides it.

/** Bare inline input that reads like receipt text, commits on blur. */
function Cell({
  value,
  onCommit,
  numeric,
  placeholder,
  className,
  align = 'left',
}: {
  value: string | number
  onCommit: (raw: string) => void
  numeric?: boolean
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
}) {
  const initial = value === '' ? '' : String(value)
  const [draft, setDraft] = useState(initial)
  useEffect(() => setDraft(initial), [initial])
  return (
    <input
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== initial && onCommit(draft)}
      className={cn(
        'bg-transparent outline-none focus:bg-muted/60 rounded px-1 -mx-1',
        align === 'right' && 'text-right',
        className,
      )}
    />
  )
}

function num(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

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
          const low = li.confidence != null && li.confidence < LOW_CONFIDENCE
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
                <Cell
                  value={li.name}
                  placeholder="Item"
                  onCommit={(raw) => onUpdate(li.id, { name: raw })}
                  className="flex-1 font-medium"
                />
                <span className="font-semibold tabular-nums">
                  {formatLbp(li.lineTotal)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {low && (
                  <span
                    title="Low confidence — check this line"
                    className="inline-flex items-center gap-0.5 text-amber-600"
                  >
                    <RiAlertLine className="size-3.5" /> check
                  </span>
                )}
                <Cell
                  value={li.qty}
                  numeric
                  onCommit={(raw) => {
                    const qty = num(raw)
                    onUpdate(li.id, { qty, lineTotal: qty * li.unitPrice })
                  }}
                  className="w-10 text-center"
                />
                <span>×</span>
                <Cell
                  value={li.unitPrice}
                  numeric
                  onCommit={(raw) => {
                    const unitPrice = num(raw)
                    onUpdate(li.id, { unitPrice, lineTotal: li.qty * unitPrice })
                  }}
                  className="w-20"
                />
                <span className="ml-auto flex items-center gap-2">
                  {rate ? <span>{formatUsd(toUsd(li.lineTotal, rate))}</span> : null}
                  <button
                    type="button"
                    onClick={() => onRemove(li.id)}
                    className="text-muted-foreground hover:text-destructive"
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
        className="flex w-full items-center justify-center gap-1 py-3 text-sm text-muted-foreground hover:text-foreground"
      >
        <RiAddLine className="size-4" /> Add item
      </button>
    </div>
  )
}
