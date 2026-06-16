import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiCheckLine, RiFileCopyLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { CurrencyToggle, type Currency } from '~/components/CurrencyToggle'
import { PortfolioReceipt } from '~/components/bill/PortfolioReceipt'
import { AnimatedAmount } from '~/components/bill/AnimatedAmount'
import { billQueries, usePublish } from '~/queries'
import { computePortfolios, personClaimedLines } from '~/lib/split'
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
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
  const publish = usePublish()
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
  const published = bill.status === 'PUBLISHED'

  async function shareLink() {
    await publish.mutateAsync({ id: billId })
    const url = `${window.location.origin}/b/${bill.shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch {
      toast(url)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">{bill.merchantName || 'Totals'}</h1>
          {bill.rate ? (
            <p className="text-xs text-muted-foreground">
              {formatLbp(bill.rate)} / $1 · {bill.rateSource}
            </p>
          ) : null}
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {!bill.rate && (
        <p className="text-sm text-amber-600">
          No rate set — USD shows as $0.00. Add printed totals on the review screen.
        </p>
      )}

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
        <AnimatedAmount
          value={currency === 'LBP' ? grandLbp : toUsd(grandLbp, bill.rate)}
          format={currency === 'LBP' ? formatLbp : formatUsd}
          className="text-lg font-black"
        />
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={shareLink}
        disabled={publish.isPending}
      >
        {published ? <RiCheckLine /> : <RiFileCopyLine />}
        {published ? 'Copy share link again' : 'Publish & copy share link'}
      </Button>
    </div>
  )
}
