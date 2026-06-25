import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  RiArrowRightLine,
  RiLockLine,
  RiShareLine,
} from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { BillSplitWorkspace } from '~/components/bill/BillSplitWorkspace'
import {
  billQueries,
  useAddHostPerson,
  useFinalize,
  usePublish,
  useRemoveHostPerson,
  useSaveHostClaims,
  useShareHostItemEvenly,
} from '~/queries'
import { recordBill } from '~/lib/billHistory'
import type { Claim } from '~/lib/types'

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
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
  const publish = usePublish()
  const finalize = useFinalize()
  const addHostPerson = useAddHostPerson()
  const removeHostPerson = useRemoveHostPerson()
  const saveHostClaims = useSaveHostClaims()
  const shareHostItemEvenly = useShareHostItemEvenly()

  const [activeId, setActiveId] = useState<string | null>(
    bill.people[0]?.id ?? null,
  )
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  // Keep an active person selected as people are added/removed.
  useEffect(() => {
    if (!bill.people.some((p) => p.id === activeId)) {
      setActiveId(bill.people[0]?.id ?? null)
    }
  }, [bill.people, activeId])

  const finalized = bill.status === 'FINALIZED'
  const shared = bill.status === 'PUBLISHED' || finalized

  // Remember this bill locally for the scan page's resume + recent list.
  useEffect(() => {
    recordBill({ billId, step: 'split', name: bill.merchantName })
  }, [billId, bill.merchantName])

  const workspaceBill = {
    merchantName: bill.merchantName,
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    rate: bill.rate,
    status: bill.status,
  }

  function claimsForPerson(claims: Claim[], personId: string) {
    return claims
      .filter((c) => c.personId === personId && c.units > 0)
      .map((c) => ({ itemId: c.itemId, units: c.units }))
  }

  function unitsFor(claims: Claim[], itemId: string, personId: string): number {
    return (
      claims.find((c) => c.itemId === itemId && c.personId === personId)
        ?.units ?? 0
    )
  }

  async function addPerson(name: string) {
    const result = await addHostPerson.mutateAsync({ id: billId, name })
    setActiveId(result.personId)
  }

  async function removePerson(personId: string) {
    await removeHostPerson.mutateAsync({ id: billId, personId })
  }

  async function savePersonClaims(
    personId: string,
    nextClaims: Array<{ itemId: string; units: number }>,
  ) {
    const result = await saveHostClaims.mutateAsync({
      id: billId,
      personId,
      claims: nextClaims,
    })
    setConflictMessage(
      result.rejectedCount > 0
        ? 'Some units were already claimed, so we kept only what was still available.'
        : null,
    )
  }

  function stepClaim(itemId: string, personId: string, delta: number) {
    const current = unitsFor(bill.claims, itemId, personId)
    const nextUnits = Math.max(0, current + delta)
    const nextClaims = claimsForPerson(bill.claims, personId).filter(
      (c) => c.itemId !== itemId,
    )
    if (nextUnits > 0) nextClaims.push({ itemId, units: nextUnits })
    void savePersonClaims(personId, nextClaims)
  }

  function shareEvenly(itemId: string, personIds: string[]) {
    void shareHostItemEvenly.mutateAsync({ id: billId, itemId, personIds })
  }

  async function shareSplitLink() {
    // The token exists from creation, so we can build the URL synchronously and
    // keep the tap gesture alive for navigator.share on iOS. Flip the bill to
    // PUBLISHED in the background (don't await — that would consume the gesture).
    const url = `${window.location.origin}/join/${bill.shareToken}`
    if (!shared) void publish.mutateAsync({ id: billId })

    // Prefer the native share sheet (the nice path on iPhone); fall back to the
    // clipboard, then to surfacing the raw link as a last resort.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Split: ${bill.merchantName || 'the bill'}`,
          text: 'Join the split and claim your items',
          url,
        })
        return
      } catch (err) {
        // User dismissed the sheet — don't fall through to a confusing copy.
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success('Split link copied')
    } catch {
      toast(url)
    }
  }

  async function finalizeSplit() {
    const confirmed = window.confirm(
      'Finalize this split? This locks edits for everyone and turns the summary into a read-only receipt.',
    )
    if (!confirmed) return
    await finalize.mutateAsync({ id: billId })
    navigate({ to: '/summary/$billId', params: { billId } })
  }

  return (
    <BillSplitWorkspace
      bill={workspaceBill}
      description="Pick a person, claim their items, and invite everyone from this same screen."
      notice={
        finalized ? (
          <div className="flex items-center gap-2.5 rounded-2xl bg-muted px-4 py-2.5 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
            <RiLockLine className="size-4 shrink-0" />
            This split is finalized, so edits are locked for everyone.
          </div>
        ) : null
      }
      people={bill.people}
      activeId={activeId}
      onSelect={setActiveId}
      onAdd={finalized ? undefined : addPerson}
      onRemove={finalized ? undefined : removePerson}
      onStep={stepClaim}
      onShareEvenly={shareEvenly}
      showClaims={!finalized}
      conflictMessage={conflictMessage}
      savingMessage={
        saveHostClaims.isPending || shareHostItemEvenly.isPending
          ? 'Saving split...'
          : null
      }
      actionSlot={
        finalized ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate({ to: '/summary/$billId', params: { billId } })}
          >
            View final summary <RiArrowRightLine />
          </Button>
        ) : (
          <div className="grid gap-2">
            <Button
              size="lg"
              className="w-full"
              onClick={() => void shareSplitLink()}
              disabled={publish.isPending}
            >
              <RiShareLine />
              {shared ? 'Share split link again' : 'Invite people to split'}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="w-full"
              onClick={() => void finalizeSplit()}
              disabled={finalize.isPending}
            >
              <RiLockLine />
              Finalize split
            </Button>
          </div>
        )
      }
    />
  )
}
