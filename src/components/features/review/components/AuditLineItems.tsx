import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  RiAddLine,
  RiAlertLine,
  RiDeleteBin6Line,
  RiReceiptLine,
} from '@remixicon/react'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'
import { formatLbpCompact, parseNumericInput } from '~/lib/format'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import {
  ELEVATED_CARD,
  ELEVATED_CARD_HOVER,
  LOW_CONFIDENCE_THRESHOLD,
  MIN_PLAUSIBLE_LBP,
} from '~/lib/bill/constants'
import {
  pulseOnce,
  revealContainer,
  revealRow,
  revealTailDelay,
} from '~/lib/ui'
import { cn } from '~/lib/utils'
import type { LineItem } from '~/lib/types'
import { reviewCopy } from '../content'

/** The two things extraction flags: a shaky read, or an LBP amount that can't be one. */
function isFlagged(item: LineItem) {
  return (
    (item.confidence != null && item.confidence < LOW_CONFIDENCE_THRESHOLD) ||
    (item.lineTotal > 0 && item.lineTotal < MIN_PLAUSIBLE_LBP)
  )
}

export function AuditLineItems({
  lineItems,
  rate,
  onUpdate,
  onRemove,
  onAdd,
  readOnly = false,
  animateIn = false,
}: {
  lineItems: LineItem[]
  rate: number | null | undefined
  onUpdate: (id: string, patch: Partial<LineItem>) => void
  onRemove: (id: string) => void
  onAdd: () => void
  readOnly?: boolean
  /** Write the rows in one by one — set only on the mount that follows a scan. */
  animateIn?: boolean
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

      <RevealList animateIn={animateIn}>
        {lineItems.map((item) => (
          <RevealRow
            key={item.id}
            animateIn={animateIn}
            pulse={isFlagged(item)}
            pulseDelay={revealTailDelay(lineItems.length)}
          >
            <AuditLineItem
              item={item}
              rate={rate}
              onUpdate={onUpdate}
              onRemove={onRemove}
              readOnly={readOnly}
            />
          </RevealRow>
        ))}
      </RevealList>

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

// Motion only exists on the reveal mount; every later edit re-renders plain
// elements so a price change never re-staggers the whole receipt.
function RevealList({
  animateIn,
  children,
}: {
  animateIn: boolean
  children: ReactNode
}) {
  if (!animateIn) return <div className="space-y-3">{children}</div>
  return (
    <motion.div
      className="space-y-3"
      variants={revealContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}

function RevealRow({
  animateIn,
  pulse,
  pulseDelay,
  children,
}: {
  animateIn: boolean
  pulse: boolean
  pulseDelay: number
  children: ReactNode
}) {
  if (!animateIn) return children
  return (
    <motion.div variants={revealRow} className="relative isolate">
      {/* Behind the (opaque) card, so the flash reads as a halo rather than
          covering the line it is pointing at. */}
      {pulse ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-card"
          animate={pulseOnce.animate}
          transition={{ ...pulseOnce.transition, delay: pulseDelay }}
        />
      ) : null}
      {children}
    </motion.div>
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
  // The header's currency chip drives the headline; the LBP field below stays
  // put in every mode because it is the value of record being edited.
  const { display } = useCurrencyDisplay()
  const headline =
    display === 'lbp'
      ? formatLbp(item.lineTotal)
      : formatUsd(toUsd(item.lineTotal, rate))
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
      <div className={cn('space-y-3 p-4 sm:hidden', ELEVATED_CARD)}>
        <div className="flex items-start gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Item name
            </span>
            <BlurCommitInput
              value={item.name}
              placeholder="Item"
              onCommit={(raw) => onUpdate(item.id, { name: raw })}
              readOnly={readOnly}
              className="min-h-11 w-full min-w-0 rounded-lg bg-muted/50 px-2 text-base font-bold"
            />
          </label>
          {readOnly ? null : (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="mt-5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-[scale,background-color,color] hover:bg-destructive/10 hover:text-destructive active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Remove ${item.name || 'item'}`}
            >
              <RiDeleteBin6Line className="size-4" />
            </button>
          )}
        </div>
        {low ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-1 text-xs font-semibold text-warning-subtle-foreground">
            <RiAlertLine className="size-3.5" /> Check this item against the
            photo
          </span>
        ) : null}
        <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
          <label>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Qty
            </span>
            <BlurCommitInput
              value={item.qty}
              numeric
              onCommit={commitQty}
              readOnly={readOnly}
              align="center"
              className="min-h-11 w-full rounded-lg bg-muted/50 text-base font-bold"
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Line total · LBP
            </span>
            <BlurCommitInput
              value={Math.round(item.lineTotal)}
              numeric
              onCommit={commitLineTotal}
              readOnly={readOnly}
              align="right"
              className="min-h-11 w-full rounded-lg bg-muted/50 px-3 text-base font-semibold"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            <span className="font-receipt">{formatLbp(item.unitPrice)}</span>{' '}
            each
          </span>
          <span className="break-words font-receipt text-xl font-bold tracking-tight text-primary-strong">
            {headline}
          </span>
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
            {headline}
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
