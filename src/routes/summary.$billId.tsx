import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiFileCopyLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { CurrencyToggle, type Currency } from '~/components/CurrencyToggle'
import { billQueries, useFinalizeShare } from '~/queries'
import { computePortfolios } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'

export const Route = createFileRoute('/summary/$billId')({
  component: Summary,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Summary() {
  const billId = Route.useParams().billId as Id<'bills'>
  const { data } = useSuspenseQuery(billQueries.detail(billId))
  const { bill, lineItems, people, assignments } = data
  const finalize = useFinalizeShare()
  const [currency, setCurrency] = useState<Currency>('LBP')

  const portfolios = computePortfolios({
    lineItems,
    people,
    assignments,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    rate: bill.rate,
    serviceSplitMode: bill.serviceSplitMode,
  })

  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const fmt = (lbp: number) =>
    currency === 'LBP' ? formatLbp(lbp) : formatUsd(toUsd(lbp, bill.rate))

  async function copyLink() {
    await finalize.mutateAsync({ id: billId })
    const url = `${window.location.origin}/b/${bill.shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch {
      toast(url)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Totals</h1>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {!bill.rate && currency === 'USD' && (
        <p className="text-sm text-amber-600">
          No rate set — USD amounts show as $0.00. Add printed totals on the review
          screen.
        </p>
      )}

      <div className="space-y-2">
        {portfolios.map((p) => (
          <div
            key={p.personId}
            className="rounded-xl border border-border p-3 space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
              <span className="font-semibold tabular-nums">{fmt(p.totalLbp)}</span>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              items {fmt(p.subtotalLbp)} · service/tax {fmt(p.serviceShareLbp)}
            </div>
          </div>
        ))}
        {portfolios.length === 0 && (
          <p className="text-sm text-muted-foreground">No people to show.</p>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Grand total</span>
        <span className="text-lg font-black tabular-nums">{fmt(grandLbp)}</span>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={copyLink}
        disabled={finalize.isPending}
      >
        <RiFileCopyLine /> Copy share link
      </Button>
    </div>
  )
}
