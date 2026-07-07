import { createFileRoute } from '@tanstack/react-router'
import { Loader } from '~/components/shared/Loader'
import { JoinPage } from '~/components/features/join/JoinPage'
import { billQueries } from '~/api'
import { seo } from '~/utils/seo'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'

export const Route = createFileRoute('/join/$shareToken')({
  component: GuestView,
  pendingComponent: () => <Loader />,
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
        ? `Split at ${loaderData.merchantName} — Billy`
        : 'Join the split — Billy',
      description: loaderData
        ? `${formatUsd(toUsd(loaderData.totalLbp, loaderData.rate))} / ${formatLbp(
            loaderData.totalLbp,
          )} on the bill. Claim your items and see your share in USD & LBP — no app needed.`
        : 'Claim your items and see your share in USD & LBP — no app needed.',
    }),
  }),
})

function GuestView() {
  const { shareToken } = Route.useParams()
  return <JoinPage shareToken={shareToken} />
}
