import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import {
  RiArrowRightLine,
  RiCheckLine,
  RiFileCopyLine,
  RiLockLine,
} from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { PersonRail } from '~/components/bill/PersonRail'
import { BillSplitWorkspace } from '~/components/bill/BillSplitWorkspace'
import { useBillEditor } from '~/hooks/useBillEditor'
import { billQueries, useFinalize, usePublish } from '~/queries'

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
  const publish = usePublish()
  const finalize = useFinalize()

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
  const finalized = bill.status === 'FINALIZED'
  const shared = bill.status === 'PUBLISHED' || finalized

  const workspaceBill = {
    merchantName: bill.meta.merchantName,
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.meta.serviceCharge,
    tax: bill.meta.tax,
    serviceChargeOn: bill.meta.serviceChargeOn,
    serviceSplitMode: bill.meta.serviceSplitMode,
    rate: bill.meta.rate,
    status: bill.status,
  }

  async function copySplitLink() {
    const token = await publish.mutateAsync({ id: billId })
    const url = `${window.location.origin}/b/${token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Split link copied')
    } catch {
      toast(url)
    }
  }

  async function finalizeSplit() {
    const saved = await editor.flushNow()
    if (!saved) {
      toast.error('Finish the receipt details before finalizing')
      return
    }
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
        <>
          {editor.editedElsewhere ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Someone else changed this bill. Your next save may overwrite their
              latest edit.
            </div>
          ) : null}
          {shared && !finalized ? (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              This split link is live. Guests can join and claim their own items.
            </div>
          ) : null}
          {finalized ? (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              This split is finalized, so edits are locked for everyone.
            </div>
          ) : null}
        </>
      }
      editorSlot={
        finalized ? null : (
          <PersonRail
            people={bill.people}
            activeId={activeId}
            onSelect={setActiveId}
            onAdd={addPerson}
            onRemove={removePerson}
          />
        )
      }
      activePerson={activePerson}
      onStep={stepClaim}
      onShareEvenly={shareEvenly}
      showClaims={!finalized}
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
              onClick={() => void copySplitLink()}
              disabled={publish.isPending}
            >
              {shared ? <RiCheckLine /> : <RiFileCopyLine />}
              {shared ? 'Copy split link again' : 'Invite people to split'}
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
