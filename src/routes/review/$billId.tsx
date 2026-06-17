import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  RiAddLine,
  RiAlertLine,
  RiArrowRightLine,
  RiDeleteBin6Line,
  RiExchangeDollarLine,
  RiLoader4Line,
  RiReceiptLine,
} from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { BlurCommitInput } from '~/components/bill/BlurCommitInput'
import { AnimatedAmount } from '~/components/bill/AnimatedAmount'
import { useBillEditor } from '~/hooks/useBillEditor'
import { billQueries } from '~/queries'
import { reconcile } from '~/lib/reconcile'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { parseNumericInput } from '~/lib/number'
import { canPersistWorkingBill } from '~/lib/bill/working'
import { LOW_CONFIDENCE_THRESHOLD } from '~/lib/bill/constants'
import type { LineItem } from '~/lib/types'
import type { WorkingMeta } from '~/lib/bill/types'

export const Route = createFileRoute('/review/$billId')({
  component: Review,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Review() {
  const billId = Route.useParams().billId as Id<'bills'>
  const navigate = useNavigate()
  const editor = useBillEditor(billId)
  const { bill, setMeta, addLineItem, updateLineItem, removeLineItem } = editor
  const { meta } = bill
  const canContinue = bill.lineItems.length > 0 && canPersistWorkingBill(bill)

  const recon = reconcile({
    lineItems: bill.lineItems,
    serviceCharge: meta.serviceChargeOn ? meta.serviceCharge : 0,
    tax: meta.serviceChargeOn ? meta.tax : 0,
    printedTotal: meta.printedTotalLbp ?? null,
  })

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <div className="mb-6 text-center lg:hidden">
        <p className="text-sm text-muted-foreground">
          Review the scanned items before splitting.
        </p>
      </div>

      {editor.extracting ? <ExtractingBanner /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="rounded-4xl bg-card/80 p-4 shadow-[0_18px_56px_rgba(0,0,0,0.06)] ring-1 ring-border/50 backdrop-blur sm:p-6 lg:p-8">
          <div className="mb-7">
            <div className="min-w-0">
              <BlurCommitInput
                value={meta.merchantName}
                placeholder="Store name"
                onCommit={(raw) => setMeta({ merchantName: raw })}
                className="w-full text-3xl font-black tracking-tight sm:text-4xl"
              />
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <RiReceiptLine className="size-4" />
                Receipt audit
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RateField
              rate={meta.rate}
              onCommit={(raw) =>
                setMeta({ rate: parseNumericInput(raw), rateSource: 'manual' })
              }
            />
            {editor.saving ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                <RiLoader4Line className="size-3.5 animate-spin" />
                Saving
              </span>
            ) : null}
          </div>

          <AuditLineItems
            lineItems={bill.lineItems}
            rate={meta.rate}
            onUpdate={updateLineItem}
            onRemove={removeLineItem}
            onAdd={() => addLineItem()}
          />

          {recon.diff != null && !recon.ok && meta.printedTotalLbp != null ? (
            <p className="mt-4 rounded-3xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Items differ from the printed receipt total by{' '}
              {formatLbp(Math.abs(recon.diff))}. Check the lines above.
            </p>
          ) : null}
        </section>

        <SettlementSummary
          total={recon.computed}
          rate={meta.rate}
          meta={meta}
          onMetaChange={setMeta}
          canContinue={canContinue}
          onContinue={async () => {
            const saved = await editor.flushNow()
            if (!saved) return
            navigate({ to: '/split/$billId', params: { billId } })
          }}
        />
      </div>

      <MobileReviewAction
        total={recon.computed}
        rate={meta.rate}
        canContinue={canContinue}
        onContinue={async () => {
          const saved = await editor.flushNow()
          if (!saved) return
          navigate({ to: '/split/$billId', params: { billId } })
        }}
      />
    </div>
  )
}

// The USD↔LBP rate defaults to 90,000 and is correct ~95% of the time, so it's
// hidden behind a disclosure — only surface the editor when the venue actually
// charged a different rate.
function RateField({
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

function ExtractingBanner() {
  return (
    <div className="mb-5 flex items-center justify-center gap-2 rounded-3xl border border-border bg-card/80 p-3 text-sm text-muted-foreground shadow-sm">
      <RiLoader4Line className="animate-spin" /> Reading your receipt...
    </div>
  )
}

function AuditLineItems({
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
      <div className="hidden gap-3 border-b border-border/70 pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_9rem]">
        <span>Item</span>
        <span className="text-right">Amount</span>
      </div>

      <div className="space-y-3 sm:divide-y sm:divide-dashed sm:divide-border/70 sm:space-y-0">
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
        className="flex w-full items-center justify-center gap-2 rounded-4xl border-2 border-dashed border-primary/30 px-4 py-4 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
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
      <div className="rounded-4xl bg-background/85 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)] ring-1 ring-border/35 sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <BlurCommitInput
              value={item.name}
              placeholder="Item"
              onCommit={(raw) => onUpdate(item.id, { name: raw })}
              className="w-full min-w-0 text-lg font-black leading-tight tracking-tight"
            />
            {low ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <RiAlertLine className="size-3.5" />
                Check this
              </span>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <span className="block text-3xl font-black tracking-tight text-primary tabular-nums">
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
          <label className="rounded-[1.35rem] bg-muted/65 px-3 py-2">
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

          <div className="min-w-0 rounded-[1.35rem] bg-muted/65 px-3 py-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Unit price
            </span>
            <span className="mt-0.5 block truncate text-sm font-black tabular-nums text-foreground">
              {formatLbpCompact(item.unitPrice)} LBP
            </span>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="grid place-items-center rounded-[1.35rem] bg-muted/65 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove item"
          >
            <RiDeleteBin6Line className="size-5" />
          </button>
        </div>
      </div>

      <div className="group hidden grid-cols-[minmax(0,1fr)_9rem] gap-3 px-2 py-4 transition-colors hover:bg-muted/40 sm:grid">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <BlurCommitInput
              value={item.name}
              placeholder="Item"
              onCommit={(raw) => onUpdate(item.id, { name: raw })}
              className="w-full min-w-0 text-base font-black leading-tight tracking-tight"
            />
            {low ? (
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-600">
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
              className="ml-1 inline-flex items-center text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
              aria-label="Remove item"
            >
              <RiDeleteBin6Line className="size-4" />
            </button>
          </div>
        </div>

        <div className="text-right">
          <span className="block text-base font-black tracking-tight text-foreground tabular-nums">
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

function SettlementSummary({
  total,
  rate,
  meta,
  onMetaChange,
  canContinue,
  onContinue,
}: {
  total: number
  rate: number | null | undefined
  meta: WorkingMeta
  onMetaChange: (patch: Partial<WorkingMeta>) => void
  canContinue: boolean
  onContinue: () => Promise<void>
}) {
  return (
    <aside className="hidden lg:sticky lg:top-24 lg:block">
      <section className="rounded-4xl bg-muted/80 p-5 shadow-[0_18px_56px_rgba(0,0,0,0.08)] ring-1 ring-border/40 backdrop-blur sm:p-6">
        <h2 className="mb-5 flex items-center gap-2 text-base font-black">
          <RiReceiptLine className="size-5" />
          Settlement summary
        </h2>

        <div className="flex items-end justify-between">
          <span className="text-3xl font-black tracking-tight">Total</span>
          <div className="text-right">
            <AnimatedAmount
              value={toUsd(total, rate)}
              format={formatUsd}
              className="block text-4xl font-black tracking-tight text-primary"
            />
            <AnimatedAmount
              value={total}
              format={formatLbpCompact}
              className="block text-sm font-semibold text-primary/80"
            />
          </div>
        </div>

        <CompactServiceTaxControl meta={meta} onChange={onMetaChange} />

        <Button
          size="lg"
          className="mt-6 h-14 w-full text-base shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
          disabled={!canContinue}
          onClick={() => void onContinue()}
        >
          Proceed to split
          <RiArrowRightLine />
        </Button>
      </section>
    </aside>
  )
}

function MobileReviewAction({
  total,
  rate,
  canContinue,
  onContinue,
}: {
  total: number
  rate: number | null | undefined
  canContinue: boolean
  onContinue: () => Promise<void>
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-4 pt-8 lg:hidden">
      <div className="rounded-[2rem] bg-muted/95 p-3 shadow-[0_-18px_54px_rgba(0,0,0,0.10)] ring-1 ring-border/60 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between rounded-[1.6rem] bg-background/75 px-4 py-3">
          <span className="text-sm font-black text-muted-foreground">Total</span>
          <div className="text-right leading-none">
            <AnimatedAmount
              value={toUsd(total, rate)}
              format={formatUsd}
              className="block text-3xl font-black tracking-tight text-primary"
            />
            <AnimatedAmount
              value={total}
              format={formatLbpCompact}
              className="mt-1 block text-xs font-bold text-primary/80"
            />
          </div>
        </div>
        <Button
          size="lg"
          className="h-[3.25rem] w-full text-base shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
          disabled={!canContinue}
          onClick={() => void onContinue()}
        >
          Proceed to split
          <RiArrowRightLine />
        </Button>
      </div>
    </div>
  )
}

function CompactServiceTaxControl({
  meta,
  onChange,
}: {
  meta: WorkingMeta
  onChange: (patch: Partial<WorkingMeta>) => void
}) {
  const on = meta.serviceChargeOn
  return (
    <div className="mt-5 rounded-4xl bg-background/65 p-3 ring-1 ring-border/50">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Service &amp; tax</p>
          <p className="text-xs text-muted-foreground">
            {on ? 'Included in total' : 'Not added'}
          </p>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(checked) => onChange({ serviceChargeOn: checked })}
        />
      </div>

      {on ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <CompactMoneyField
            label="Service"
            value={meta.serviceCharge}
            onCommit={(serviceCharge) => onChange({ serviceCharge })}
          />
          <CompactMoneyField
            label="Tax"
            value={meta.tax}
            onCommit={(tax) => onChange({ tax })}
          />
        </div>
      ) : null}
    </div>
  )
}

function CompactMoneyField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  return (
    <label className="rounded-3xl bg-muted/60 px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <BlurCommitInput
        numeric
        value={value}
        onCommit={(raw) => onCommit(parseNumericInput(raw))}
        align="right"
        className="mt-0.5 w-full text-right text-sm font-black tabular-nums"
      />
    </label>
  )
}

function formatLbpCompact(value: number) {
  return Math.round(value).toLocaleString('en-US')
}
