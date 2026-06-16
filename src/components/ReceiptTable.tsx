import { useEffect, useState } from 'react'
import { RiAddLine, RiDeleteBinLine } from '@remixicon/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { formatUsd, toUsd } from '~/lib/currency'
import type { Doc, Id } from 'convex/_generated/dataModel'

const LOW_CONFIDENCE = 0.6

// Self-contained editable cell: resyncs when the server value changes, commits
// on blur only if the value actually changed.
function EditableCell({
  value,
  onCommit,
  numeric,
  className,
  ariaLabel,
}: {
  value: string | number
  onCommit: (raw: string) => void
  numeric?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <Input
      aria-label={ariaLabel}
      inputMode={numeric ? 'decimal' : undefined}
      className={cn('h-8', className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== String(value)) onCommit(draft)
      }}
    />
  )
}

export interface NewLineItem {
  name: string
  qty: number
  unitPrice: number
}

// Editable line-item table (spec §4.4). Inline edit, add, delete, fix-quantity;
// low-confidence rows are flagged for a human glance.
export function ReceiptTable({
  lineItems,
  rate,
  onUpdate,
  onDelete,
  onAdd,
}: {
  lineItems: Doc<'lineItems'>[]
  rate: number | null | undefined
  onUpdate: (
    id: Id<'lineItems'>,
    patch: Partial<Pick<Doc<'lineItems'>, 'name' | 'qty' | 'unitPrice' | 'lineTotal'>>,
  ) => void
  onDelete: (id: Id<'lineItems'>) => void
  onAdd: (item: NewLineItem) => void
}) {
  const [draft, setDraft] = useState<NewLineItem>({ name: '', qty: 1, unitPrice: 0 })

  function num(raw: string) {
    const n = Number(raw.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  function addRow(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    onAdd({ ...draft, name: draft.name.trim() })
    setDraft({ name: '', qty: 1, unitPrice: 0 })
  }

  return (
    <div className="space-y-2">
      {lineItems.map((li) => {
        const low = li.confidence != null && li.confidence < LOW_CONFIDENCE
        return (
          <div
            key={li._id}
            className={cn(
              'rounded-xl border p-2.5 space-y-2',
              low ? 'border-amber-400 bg-amber-50' : 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <EditableCell
                ariaLabel="Item name"
                value={li.name}
                onCommit={(raw) => onUpdate(li._id, { name: raw })}
                className="flex-1"
              />
              {low && (
                <Badge variant="destructive" className="shrink-0">
                  check
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(li._id)}
                aria-label="Delete item"
              >
                <RiDeleteBinLine />
              </Button>
            </div>

            <div className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
              <EditableCell
                ariaLabel="Quantity"
                numeric
                value={li.qty}
                onCommit={(raw) => {
                  const qty = num(raw)
                  onUpdate(li._id, { qty, lineTotal: qty * li.unitPrice })
                }}
              />
              <EditableCell
                ariaLabel="Unit price"
                numeric
                value={li.unitPrice}
                onCommit={(raw) => {
                  const unitPrice = num(raw)
                  onUpdate(li._id, { unitPrice, lineTotal: li.qty * unitPrice })
                }}
              />
              <EditableCell
                ariaLabel="Line total"
                numeric
                value={li.lineTotal}
                onCommit={(raw) => onUpdate(li._id, { lineTotal: num(raw) })}
              />
            </div>
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>qty</span>
              <span>unit (LL)</span>
              <span>
                total (LL)
                {rate ? ` · ${formatUsd(toUsd(li.lineTotal, rate))}` : ''}
              </span>
            </div>
          </div>
        )
      })}

      <form
        onSubmit={addRow}
        className="rounded-xl border border-dashed border-border p-2.5 space-y-2"
      >
        <Input
          placeholder="Add an item…"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-8"
        />
        <div className="grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-2">
          <Input
            aria-label="New quantity"
            inputMode="decimal"
            className="h-8"
            value={String(draft.qty)}
            onChange={(e) => setDraft({ ...draft, qty: num(e.target.value) })}
          />
          <Input
            aria-label="New unit price"
            inputMode="decimal"
            className="h-8"
            value={String(draft.unitPrice)}
            onChange={(e) => setDraft({ ...draft, unitPrice: num(e.target.value) })}
          />
          <div className="text-sm tabular-nums text-muted-foreground self-center">
            = {(draft.qty * draft.unitPrice).toLocaleString('en-US')}
          </div>
          <Button type="submit" variant="outline" size="icon-sm" aria-label="Add item">
            <RiAddLine />
          </Button>
        </div>
      </form>
    </div>
  )
}
