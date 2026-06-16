import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RiArrowRightLine, RiLoader4Line } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { BlurCommitInput } from '~/components/bill/BlurCommitInput'
import { ReceiptLines } from '~/components/bill/ReceiptLines'
import { ServicePanel } from '~/components/bill/ServicePanel'
import { AnimatedAmount } from '~/components/bill/AnimatedAmount'
import { useBillEditor } from '~/hooks/useBillEditor'
import { billQueries } from '~/queries'
import { reconcile } from '~/lib/reconcile'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { parseNumericInput } from '~/lib/number'
import { canPersistWorkingBill } from '~/lib/bill/working'

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
    <div className="mx-auto w-full max-w-md p-4 sm:p-6">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        {/* Receipt header — merchant + the USD headline */}
        <div className="text-center">
          <BlurCommitInput
            value={meta.merchantName}
            placeholder="Merchant"
            onCommit={(raw) => setMeta({ merchantName: raw })}
            align="center"
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
            {formatLbp(meta.rate ?? 0)} / $1
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

        {/* Items don't match what the receipt printed (extraction reference only) */}
        {recon.diff != null && !recon.ok && meta.printedTotalLbp != null && (
          <p className="mt-3 text-xs text-destructive">
            Items don't match the receipt total by{' '}
            {formatLbp(Math.abs(recon.diff))} — check the lines above.
          </p>
        )}

        <div className="my-4 border-t border-dashed border-border" />

        <RateField
          rate={meta.rate}
          onCommit={(raw) =>
            setMeta({ rate: parseNumericInput(raw), rateSource: 'manual' })
          }
        />

        <div className="mt-4">
          <ServicePanel meta={meta} onChange={setMeta} />
        </div>
      </div>

      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={!canContinue}
        onClick={async () => {
          const saved = await editor.flushNow()
          if (!saved) return
          navigate({ to: '/split/$billId', params: { billId } })
        }}
      >
        Continue to split <RiArrowRightLine />
      </Button>
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
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
      >
        <span>Exchange rate</span>
        <span className="tabular-nums">
          {formatLbp(rate ?? 0)} / $1 · Adjust
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        Exchange rate (LL per $1)
      </p>
      <BlurCommitInput
        value={rate}
        numeric
        placeholder="90,000"
        onCommit={onCommit}
        align="center"
        className="w-full rounded-md border border-border py-1.5 text-sm tabular-nums"
      />
      <p className="text-xs text-muted-foreground">
        Only change this if the venue used a different rate.
      </p>
    </div>
  )
}
