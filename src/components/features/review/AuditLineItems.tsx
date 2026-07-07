import {
  RiAddLine,
  RiAlertLine,
  RiDeleteBin6Line,
} from '@remixicon/react'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatUsd, toUsd } from '~/lib/currency'
import { formatLbpCompact } from '~/lib/format'
import { parseNumericInput } from '~/lib/number'
import {
  ELEVATED_CARD,
  ELEVATED_CARD_HOVER,
  LOW_CONFIDENCE_THRESHOLD,
} from '~/lib/bill/constants'
import { cn } from '~/lib/utils'
import type { LineItem } from '~/lib/types'

export function AuditLineItems({
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
    <div className="space-y-4">
      <div className="hidden gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_9rem]">
        <span>Item</span>
        <span className="text-right">Amount</span>
      </div>

      <div className="space-y-3">
        {lineItems.map((item) => (
          <AuditLineItem
            key={item.id}
            item={item}
            rate={rate}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-control border-2 border-dashed border-primary/30 px-4 py-4 text-sm font-bold text-primary-strong transition-[transform,background-color] hover:bg-primary/10 active:scale-[0.96]"
      >
        <RiAddLine className="size-5" />
        Add item
      </button>
    </div>
  )
}

function AuditLineItem({
  item,
  rate,
  onUpdate,
  onRemove,
}: {
  item: LineItem
  rate: number | null | undefined
  onUpdate: (id: string, patch: Partial<LineItem>) => void
  onRemove: (id: string) => void
}) {
  const low =
    item.confidence != null && item.confidence < LOW_CONFIDENCE_THRESHOLD
  const commitQty = (raw: string) => {
    const qty = parseNumericInput(raw)
    onUpdate(item.id, {
      qty,
      lineTotal: qty * item.unitPrice,
    })
  }
  const commitLineTotal = (raw: string) => {
    const lineTotal = parseNumericInput(raw)
    onUpdate(item.id, {
      lineTotal,
      unitPrice: item.qty > 0 ? lineTotal / item.qty : lineTotal,
    })
  }

  return (
    <>
      <div className={cn('p-4 sm:hidden', ELEVATED_CARD)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <BlurCommitInput
              value={item.name}
              placeholder="Item"
              onCommit={(raw) => onUpdate(item.id, { name: raw })}
              className="w-full min-w-0 text-lg font-black leading-tight tracking-tight"
            />
            {low ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-warning-subtle-foreground">
                <RiAlertLine className="size-3.5" />
                Check this
              </span>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <span className="block font-receipt text-3xl font-bold tracking-tight text-primary-strong">
              {formatUsd(toUsd(item.lineTotal, rate))}
            </span>
            <div className="mt-1.5 flex items-center justify-end gap-1 text-xs font-semibold text-muted-foreground">
              <BlurCommitInput
                value={Math.round(item.lineTotal)}
                numeric
                onCommit={commitLineTotal}
                align="right"
                className="w-24 text-right tabular-nums text-muted-foreground focus:bg-muted"
              />
              <span>LBP</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] gap-2">
          <label className="rounded-xl bg-muted/65 px-3 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Qty
            </span>
            <BlurCommitInput
              value={item.qty}
              numeric
              onCommit={commitQty}
              align="center"
              className="mt-0.5 w-full text-center text-base font-black tabular-nums text-foreground focus:bg-muted"
            />
          </label>

          <div className="min-w-0 rounded-xl bg-muted/65 px-3 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Unit price
            </span>
            <span className="mt-0.5 block truncate font-receipt text-sm font-bold text-foreground">
              {formatLbpCompact(item.unitPrice)} LBP
            </span>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="grid place-items-center rounded-xl bg-muted/65 text-muted-foreground transition-[transform,background-color,color] hover:bg-destructive/10 hover:text-destructive active:scale-[0.96]"
            aria-label="Remove item"
          >
            <RiDeleteBin6Line className="size-5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'group hidden grid-cols-[minmax(0,1fr)_9rem] gap-3 p-4 transition-[box-shadow,border-color] sm:grid',
          ELEVATED_CARD,
          ELEVATED_CARD_HOVER,
        )}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <BlurCommitInput
              value={item.name}
              placeholder="Item"
              onCommit={(raw) => onUpdate(item.id, { name: raw })}
              className="w-full min-w-0 text-base font-black leading-tight tracking-tight"
            />
            {low ? (
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-warning-subtle-foreground">
                <RiAlertLine className="size-3.5" />
                Check this
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>Qty</span>
            <BlurCommitInput
              value={item.qty}
              numeric
              onCommit={commitQty}
              align="center"
              className="w-7 rounded-full bg-muted/70 px-1.5 py-0 text-center font-black tabular-nums text-foreground focus:bg-muted"
            />
            <span className="min-w-0 truncate tabular-nums">
              {formatLbpCompact(item.unitPrice)} LBP each
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="ml-1 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[transform,color,opacity] hover:text-destructive active:scale-[0.96] group-hover:opacity-100"
              aria-label="Remove item"
            >
              <RiDeleteBin6Line className="size-4" />
            </button>
          </div>
        </div>

        <div className="text-right">
          <span className="block font-receipt text-base font-bold tracking-tight text-foreground">
            {formatUsd(toUsd(item.lineTotal, rate))}
          </span>
          <div className="mt-1.5 flex items-center justify-end gap-1 text-xs font-semibold text-muted-foreground">
            <BlurCommitInput
              value={Math.round(item.lineTotal)}
              numeric
              onCommit={commitLineTotal}
              align="right"
              className="w-24 text-right tabular-nums text-muted-foreground focus:bg-muted"
            />
            <span>LBP</span>
          </div>
        </div>
      </div>
    </>
  )
}
