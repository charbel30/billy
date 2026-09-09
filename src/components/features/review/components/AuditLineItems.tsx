import {
  RiAddLine,
  RiAlertLine,
  RiDeleteBin6Line,
  RiReceiptLine,
} from '@remixicon/react'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatUsd, toUsd } from '~/lib/money'
import { formatLbpCompact, parseNumericInput } from '~/lib/format'
import {
  ELEVATED_CARD,
  ELEVATED_CARD_HOVER,
  LOW_CONFIDENCE_THRESHOLD,
} from '~/lib/bill/constants'
import { cn } from '~/lib/utils'
import type { LineItem } from '~/lib/types'
import { reviewCopy } from '../content'

export function AuditLineItems({
  lineItems,
  rate,
  onUpdate,
  onRemove,
  onAdd,
  readOnly = false,
}: {
  lineItems: LineItem[]
  rate: number | null | undefined
  onUpdate: (id: string, patch: Partial<LineItem>) => void
  onRemove: (id: string) => void
  onAdd: () => void
  readOnly?: boolean
}) {
  // Empty is a first-class state, not an error: manual entry starts here, and
  // so does a bill whose extraction failed. A bare "Add item" row reads like a
  // broken screen, so lead with what to do.
  if (lineItems.length === 0) {
    return (
      <div className="rounded-card border-2 border-dashed border-primary/30 px-6 py-10 text-center">
        <RiReceiptLine className="mx-auto size-8 text-primary-strong/60" />
        <p className="mt-3 text-lg font-black tracking-tight">
          {reviewCopy.emptyTitle}
        </p>
        <p className="mx-auto mt-1 max-w-xs text-pretty text-sm text-muted-foreground">
          {readOnly
            ? 'No receipt items are available to view.'
            : reviewCopy.emptyHint}
        </p>
        {readOnly ? null : (
          <button
            type="button"
            onClick={onAdd}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-raised transition-[scale] duration-200 active:scale-[0.96]"
          >
            <RiAddLine className="size-5" />
            {reviewCopy.addFirstAction}
          </button>
        )}
      </div>
    )
  }

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
            readOnly={readOnly}
          />
        ))}
      </div>

      {readOnly ? null : (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-control border-2 border-dashed border-primary/30 px-4 py-4 text-sm font-bold text-primary-strong transition-[scale,background-color] hover:bg-primary/10 active:scale-[0.96]"
        >
          <RiAddLine className="size-5" />
          {reviewCopy.addAction}
        </button>
      )}
    </div>
  )
}

function AuditLineItem({
  item,
  rate,
  onUpdate,
  onRemove,
  readOnly,
}: {
  item: LineItem
  rate: number | null | undefined
  onUpdate: (id: string, patch: Partial<LineItem>) => void
  onRemove: (id: string) => void
  readOnly: boolean
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
              readOnly={readOnly}
              className="w-full min-w-0 text-lg font-black leading-tight tracking-tight"
            />
            {low ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-warning-subtle-foreground">
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
                readOnly={readOnly}
                align="right"
                className="w-24 text-right text-muted-foreground"
              />
              <span>LBP</span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'mt-4 grid gap-2',
            readOnly
              ? 'grid-cols-[5.5rem_minmax(0,1fr)]'
              : 'grid-cols-[5.5rem_minmax(0,1fr)_2.5rem]',
          )}
        >
          <label className="rounded-control bg-muted/65 px-3 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Qty
            </span>
            <BlurCommitInput
              value={item.qty}
              numeric
              onCommit={commitQty}
              readOnly={readOnly}
              align="center"
              className="mt-0.5 w-full text-center text-base font-bold text-foreground"
            />
          </label>

          <div className="min-w-0 rounded-control bg-muted/65 px-3 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Unit price
            </span>
            <span className="mt-0.5 block truncate font-receipt text-sm font-bold text-foreground">
              {formatLbpCompact(item.unitPrice)} LBP
            </span>
          </div>

          {readOnly ? null : (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="grid place-items-center rounded-control bg-muted/65 text-muted-foreground transition-[scale,background-color,color] hover:bg-destructive/10 hover:text-destructive active:scale-[0.96]"
              aria-label="Remove item"
            >
              <RiDeleteBin6Line className="size-5" />
            </button>
          )}
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
              readOnly={readOnly}
              className="w-full min-w-0 text-base font-black leading-tight tracking-tight"
            />
            {low ? (
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-semibold text-warning-subtle-foreground">
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
              readOnly={readOnly}
              align="center"
              className="w-8 rounded-full bg-muted/70 px-1.5 py-0 text-center font-bold text-foreground"
            />
            <span className="min-w-0 truncate tabular-nums">
              {formatLbpCompact(item.unitPrice)} LBP each
            </span>
            {readOnly ? null : (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="ml-1 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[scale,color,opacity] hover:text-destructive active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label="Remove item"
              >
                <RiDeleteBin6Line className="size-4" />
              </button>
            )}
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
              readOnly={readOnly}
              align="right"
              className="w-24 text-right text-muted-foreground"
            />
            <span>LBP</span>
          </div>
        </div>
      </div>
    </>
  )
}
