import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Loader } from '~/components/Loader'
import { Separator } from '~/components/ui/separator'
import { CurrencyToggle, type Currency } from '~/components/CurrencyToggle'
import { billQueries } from '~/queries'
import { computePortfolios } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'

export const Route = createFileRoute('/b/$shareToken')({
  component: GuestView,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(billQueries.byToken(params.shareToken))
  },
})

// Read-only guest view (Phase 1). No login, no edit — just see the split.
function GuestView() {
  const { shareToken } = Route.useParams()
  const { data } = useSuspenseQuery(billQueries.byToken(shareToken))
  const { bill, lineItems, people, assignments } = data
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

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">
            {bill.merchantName || 'Receipt'}
          </h1>
          {bill.rate ? (
            <p className="text-xs text-muted-foreground">
              Rate {formatLbp(bill.rate)} / $1 · {bill.rateSource}
            </p>
          ) : null}
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="space-y-2">
        {portfolios.map((p) => (
          <div key={p.personId} className="rounded-xl border border-border p-3">
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
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Grand total</span>
        <span className="text-lg font-black tabular-nums">{fmt(grandLbp)}</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          See all items ({lineItems.length})
        </summary>
        <div className="mt-2 space-y-1">
          {lineItems.map((li) => (
            <div key={li._id} className="flex justify-between tabular-nums">
              <span>
                {li.qty}× {li.name}
              </span>
              <span>{fmt(li.lineTotal)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
