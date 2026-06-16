import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RiArrowRightLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { PersonRail } from '~/components/bill/PersonRail'
import { ClaimList } from '~/components/bill/ClaimList'
import { RemainingBar } from '~/components/bill/RemainingBar'
import { useBillEditor } from '~/hooks/useBillEditor'
import { billQueries } from '~/queries'

export const Route = createFileRoute('/split/$billId')({
  component: Split,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Split() {
  const billId = Route.useParams().billId as Id<'bills'>
  const navigate = useNavigate()
  const editor = useBillEditor(billId)
  const { bill, addPerson, removePerson, stepClaim, shareEvenly } = editor

  const [activeId, setActiveId] = useState<string | null>(
    bill.people[0]?.id ?? null,
  )
  // Keep an active person selected as people are added/removed.
  useEffect(() => {
    if (!bill.people.some((p) => p.id === activeId)) {
      setActiveId(bill.people[0]?.id ?? null)
    }
  }, [bill.people, activeId])

  const activePerson = bill.people.find((p) => p.id === activeId) ?? null

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-black">Split it</h1>
        <p className="text-sm text-muted-foreground">
          Pick a person, then pull their units off the receipt.
        </p>
      </div>

      <PersonRail
        people={bill.people}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={addPerson}
        onRemove={removePerson}
      />

      <RemainingBar lineItems={bill.lineItems} claims={bill.claims} />

      <div className="rounded-3xl border border-border bg-card p-4">
        <ClaimList
          lineItems={bill.lineItems}
          people={bill.people}
          claims={bill.claims}
          activePerson={activePerson}
          rate={bill.meta.rate}
          onStep={stepClaim}
          onShareEvenly={shareEvenly}
        />
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={async () => {
          const saved = await editor.flushNow()
          if (!saved) return
          navigate({ to: '/summary/$billId', params: { billId } })
        }}
      >
        See totals <RiArrowRightLine />
      </Button>
    </div>
  )
}
