import { createFileRoute } from '@tanstack/react-router'
import { ClaimListSkeleton } from '~/components/features/bill'
import { JoinPage } from '~/components/features/join/JoinPage'
import { billQueries } from '~/api'
import { seo } from '~/lib/seo'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'

export const Route = createFileRoute('/join/$shareToken')({
  component: GuestView,
  pendingComponent: () => <ClaimListSkeleton />,
  loader: async ({ params, context: { queryClient } }) => {
    const bill = await queryClient.ensureQueryData(
      billQueries.byToken(params.shareToken),
    )
    // Feeds the OG tags below — this link unfurls in WhatsApp group chats,
    // so the preview should already say whose bill it is and how much.
    const totalLbp = bill.lineItems.reduce((s, li) => s + li.lineTotal, 0)
    return { merchantName: bill.merchantName, totalLbp, rate: bill.rate }
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData?.merchantName
        ? `Split at ${loaderData.merchantName} — Spolio`
        : 'Join the split — Spolio',
      description: loaderData
        ? `${formatUsd(toUsd(loaderData.totalLbp, loaderData.rate))} / ${formatLbp(
            loaderData.totalLbp,
          )} on the bill. Claim your items and see your share in USD & LBP — no app needed.`
        : 'Claim your items and see your share in USD & LBP — no app needed.',
      image: 'https://spolio.net/og-image.png',
      imageAlt: 'Spolio — split a receipt in LBP and USD.',
    }),
  }),
})

function GuestView() {
  const { shareToken } = Route.useParams()
  return <JoinPage shareToken={shareToken} />
}
