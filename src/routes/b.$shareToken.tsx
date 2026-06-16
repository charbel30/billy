import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { CurrencyToggle, type Currency } from '~/components/CurrencyToggle'
import { PortfolioReceipt } from '~/components/bill/PortfolioReceipt'
import { billQueries } from '~/queries'
import { computePortfolios, personClaimedLines } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'

export const Route = createFileRoute('/b/$shareToken')({
  component: GuestView,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(billQueries.byToken(params.shareToken))
  },
})

// Read-only guest view (Phase 1). No login, no edit — just see the split. Live
// multi-writer claim is a Phase-2 concern (architecture-decision.md).
function GuestView() {
  const { shareToken } = Route.useParams()
  const { data: bill } = useSuspenseQuery(billQueries.byToken(shareToken))
  const [currency, setCurrency] = useState<Currency>('USD')

  const portfolios = computePortfolios({
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    rate: bill.rate,
  })
  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const fmt = (lbp: number) =>
    currency === 'LBP' ? formatLbp(lbp) : formatUsd(toUsd(lbp, bill.rate))

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">{bill.merchantName || 'Receipt'}</h1>
          {bill.rate ? (
            <p className="text-xs text-muted-foreground">
              {formatLbp(bill.rate)} / $1 · {bill.rateSource}
            </p>
          ) : null}
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="space-y-3">
        {portfolios.map((p) => (
          <PortfolioReceipt
            key={p.personId}
            portfolio={p}
            lines={personClaimedLines(p.personId, bill.lineItems, bill.claims)}
            rate={bill.rate}
            currency={currency}
            serviceChargeOn={bill.serviceChargeOn}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <span className="text-muted-foreground">Grand total</span>
        <span className="text-lg font-black tabular-nums">{fmt(grandLbp)}</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          See all items ({bill.lineItems.length})
        </summary>
        <div className="mt-2 space-y-1">
          {bill.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between tabular-nums">
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
