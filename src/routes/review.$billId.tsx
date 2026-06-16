import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RiArrowRightLine, RiLoader4Line } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { ReceiptLines } from '~/components/bill/ReceiptLines'
import { ServicePanel } from '~/components/bill/ServicePanel'
import { AnimatedAmount } from '~/components/bill/AnimatedAmount'
import { useBillEditor } from '~/hooks/useBillEditor'
import { billQueries } from '~/queries'
import { reconcile } from '~/lib/reconcile'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'

export const Route = createFileRoute('/review/$billId')({
  component: Review,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function num(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Bare receipt-header input, commits on blur. */
function HeaderInput({
  value,
  onCommit,
  numeric,
  placeholder,
  className,
}: {
  value: string | number | undefined
  onCommit: (raw: string) => void
  numeric?: boolean
  placeholder?: string
  className?: string
}) {
  const initial = value == null ? '' : String(value)
  const [draft, setDraft] = useState(initial)
  useEffect(() => setDraft(initial), [initial])
  return (
    <input
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== initial && onCommit(draft)}
      className={`bg-transparent text-center outline-none focus:bg-muted/60 rounded px-1 ${className ?? ''}`}
    />
  )
}

function Review() {
  const billId = Route.useParams().billId as Id<'bills'>
  const navigate = useNavigate()
  const editor = useBillEditor(billId)
  const { bill, setMeta, addLineItem, updateLineItem, removeLineItem } = editor
  const { meta } = bill

  const recon = reconcile({
    lineItems: bill.lineItems,
    serviceCharge: meta.serviceChargeOn ? meta.serviceCharge : 0,
    tax: meta.serviceChargeOn ? meta.tax : 0,
    printedTotal: meta.printedTotalLbp ?? null,
  })

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        {/* Receipt header — merchant + the USD headline */}
        <div className="text-center">
          <HeaderInput
            value={meta.merchantName}
            placeholder="Merchant"
            onCommit={(raw) => setMeta({ merchantName: raw })}
            className="w-full text-lg font-black tracking-tight"
          />
          <div className="mt-3">
            <AnimatedAmount
              value={toUsd(recon.computed, meta.rate)}
              format={formatUsd}
              className="text-4xl font-black"
            />
            <div className="text-sm text-muted-foreground">
              <AnimatedAmount value={recon.computed} format={formatLbp} />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {meta.rate
              ? `${formatLbp(meta.rate)} / $1 · ${meta.rateSource}`
              : 'No rate yet — add both printed totals below'}
          </p>
        </div>

        {editor.extracting && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <RiLoader4Line className="animate-spin" /> Reading your receipt…
          </div>
        )}

        <div className="my-4 border-t border-dashed border-border" />

        <ReceiptLines
          lineItems={bill.lineItems}
          rate={meta.rate}
          onUpdate={updateLineItem}
          onRemove={removeLineItem}
          onAdd={() => addLineItem()}
        />

        <div className="my-4 border-t border-dashed border-border" />

        {/* Printed totals drive the venue rate */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Printed totals (sets the LBP/USD rate)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <HeaderInput
              value={meta.printedTotalLbp}
              numeric
              placeholder="Total LL"
              onCommit={(raw) => setMeta({ printedTotalLbp: num(raw) })}
              className="w-full rounded-md border border-border py-1.5 text-sm tabular-nums"
            />
            <HeaderInput
              value={meta.printedTotalUsd}
              numeric
              placeholder="Total $"
              onCommit={(raw) => setMeta({ printedTotalUsd: num(raw) })}
              className="w-full rounded-md border border-border py-1.5 text-sm tabular-nums"
            />
          </div>
          {recon.diff != null && !recon.ok && (
            <p className="text-xs text-destructive">
              Items don't match the printed total by{' '}
              {formatLbp(Math.abs(recon.diff))} — check the lines above.
            </p>
          )}
        </div>

        <div className="mt-4">
          <ServicePanel meta={meta} onChange={setMeta} />
        </div>
      </div>

      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={bill.lineItems.length === 0}
        onClick={async () => {
          await editor.flushNow()
          navigate({ to: '/split/$billId', params: { billId } })
        }}
      >
        Continue to split <RiArrowRightLine />
      </Button>
    </div>
  )
}
