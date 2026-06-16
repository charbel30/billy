import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RiLoader4Line } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { ReceiptTable } from '~/components/ReceiptTable'
import { ReconcileBanner } from '~/components/ReconcileBanner'
import {
  billQueries,
  useAddLineItem,
  useDeleteLineItem,
  useUpdateBillMeta,
  useUpdateLineItem,
} from '~/queries'
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

// Small uncontrolled-ish field that resyncs on server change, commits on blur.
function Field({
  label,
  value,
  onCommit,
  numeric,
  placeholder,
}: {
  label: string
  value: string | number | undefined
  onCommit: (raw: string) => void
  numeric?: boolean
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => setDraft(value == null ? '' : String(value)), [value])
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        inputMode={numeric ? 'decimal' : undefined}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== (value == null ? '' : String(value))) onCommit(draft)
        }}
      />
    </div>
  )
}

const STATUS_VARIANT = {
  DRAFT: 'secondary',
  NEEDS_REVIEW: 'destructive',
  READY: 'default',
  SHARED: 'outline',
} as const

function Review() {
  const billId = Route.useParams().billId as Id<'bills'>
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(billQueries.detail(billId))
  const { bill, lineItems } = data

  const updateMeta = useUpdateBillMeta()
  const addItem = useAddLineItem()
  const updateItem = useUpdateLineItem()
  const deleteItem = useDeleteLineItem()

  const num = (raw: string) => {
    const n = Number(raw.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  const recon = reconcile({
    lineItems,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    printedTotal: bill.printedTotalLbp ?? null,
  })

  const extracting = Boolean(bill.imageRef) && lineItems.length === 0

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Review</h1>
        <Badge variant={STATUS_VARIANT[bill.status]}>
          {bill.status.replace('_', ' ')}
        </Badge>
      </div>

      {extracting && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <RiLoader4Line className="animate-spin" /> Reading your receipt…
        </div>
      )}

      <Field
        label="Merchant"
        value={bill.merchantName}
        placeholder="Restaurant name"
        onCommit={(raw) => updateMeta.mutate({ id: billId, merchantName: raw })}
      />

      <ReconcileBanner result={recon} />

      <div className="space-y-2">
        <Label>Items</Label>
        <ReceiptTable
          lineItems={lineItems}
          rate={bill.rate}
          onUpdate={(id, patch) => updateItem.mutate({ id, ...patch })}
          onDelete={(id) => deleteItem.mutate({ id })}
          onAdd={(item) => addItem.mutate({ billId, ...item })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Service charge (LL)"
          numeric
          value={bill.serviceCharge}
          onCommit={(raw) => updateMeta.mutate({ id: billId, serviceCharge: num(raw) })}
        />
        <Field
          label="Tax (LL)"
          numeric
          value={bill.tax}
          onCommit={(raw) => updateMeta.mutate({ id: billId, tax: num(raw) })}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Printed totals (drives the LBP/USD rate)</Label>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Total LL"
            numeric
            value={bill.printedTotalLbp}
            placeholder="e.g. 19440000"
            onCommit={(raw) =>
              updateMeta.mutate({ id: billId, printedTotalLbp: num(raw) })
            }
          />
          <Field
            label="Total $"
            numeric
            value={bill.printedTotalUsd}
            placeholder="e.g. 216"
            onCommit={(raw) =>
              updateMeta.mutate({ id: billId, printedTotalUsd: num(raw) })
            }
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {bill.rate
            ? `Rate: ${formatLbp(bill.rate)} / $1 · source: ${bill.rateSource}`
            : 'No rate yet — enter both printed totals, or set one manually below.'}
        </div>
        <Field
          label="Manual rate (LL per $1)"
          numeric
          value={bill.rateSource === 'manual' ? bill.rate : undefined}
          placeholder="override"
          onCommit={(raw) =>
            updateMeta.mutate({ id: billId, rate: num(raw), rateSource: 'manual' })
          }
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Computed total</span>
        <span className="font-medium tabular-nums">
          {formatLbp(recon.computed)}
          {bill.rate ? ` · ${formatUsd(toUsd(recon.computed, bill.rate))}` : ''}
        </span>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={lineItems.length === 0}
        onClick={() => navigate({ to: '/split/$billId', params: { billId } })}
      >
        Continue to split
      </Button>
    </div>
  )
}
