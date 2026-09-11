import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  RiArrowRightLine,
  RiGroupLine,
  RiLockLine,
  RiQrCodeLine,
} from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { BillSplitWorkspace, ShareSplitDialog } from '~/components/features/bill'
import { ReadOnlyNotice } from '~/components/shared/ReadOnlyNotice'
import {
  billQueries,
  useAddHostPerson,
  useFinalize,
  usePublish,
  useRemoveHostPerson,
  useRevokeShare,
  useStepHostClaim,
  useSetTipPercent,
  useShareHostItemEvenly,
  useSplitLeftoversEvenly,
} from '~/api'
import { getHostToken, recordBill } from '~/lib/session'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { usePendingWrites } from '~/hooks/usePendingWrites'
import {
  remainingUnits,
  totalRemainingLbp,
  unallocatedAmounts,
  formatUsd,
  toUsd,
} from '~/lib/money'
import { joinUrl } from '~/lib/format'
import { trackFunnelMilestone } from '~/lib/observability'
import { leftoverItemsPhrase, splitCopy, unallocatedServiceNote } from './content'
import { useBillStepGate } from '~/hooks/useBillStepGate'

export function SplitPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const canEdit = useHasHostToken(billId)
  // Host writes carry the bill's capability, not just its id (the id is right
  // there in the URL). Read at call time so it's always the current value.
  const hostArgs = () => ({ id: billId, hostToken: getHostToken(billId) })
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
  const allowedHere = useBillStepGate(billId, 'split', bill)
  const publish = usePublish()
  const finalize = useFinalize()
  const revokeShare = useRevokeShare()
  const setTipPercent = useSetTipPercent()
  const splitLeftoversEvenly = useSplitLeftoversEvenly()
  const [qrOpen, setQrOpen] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const addHostPerson = useAddHostPerson()
  const removeHostPerson = useRemoveHostPerson()
  const stepHostClaim = useStepHostClaim()
  const shareHostItemEvenly = useShareHostItemEvenly()

  const [activeId, setActiveId] = useState<string | null>(
    bill.people[0]?.id ?? null,
  )
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const writes = usePendingWrites()
  const finalizing = useRef(false)
  const [preparingFinalize, setPreparingFinalize] = useState(false)
  // Keep an active person selected as people are added/removed.
  useEffect(() => {
    if (!bill.people.some((p) => p.id === activeId)) {
      setActiveId(bill.people[0]?.id ?? null)
    }
  }, [bill.people, activeId])

  const finalized = bill.status === 'FINALIZED'
  const shared = bill.status === 'PUBLISHED' || finalized

  const remainingLbp = totalRemainingLbp(bill.lineItems, bill.claims)
  const unallocatedServiceLbp = unallocatedAmounts(bill).serviceLbp
  const allClaimed = remainingLbp <= 0.5
  const leftoverItemCount = bill.lineItems.filter(
    (item) => remainingUnits(item, bill.claims) > 0.0001,
  ).length

  // Remember this bill locally for the scan page's resume + recent list.
  useEffect(() => {
    if (!canEdit) return
    recordBill({ billId, step: 'split', name: bill.merchantName })
  }, [billId, bill.merchantName, canEdit])

  const workspaceBill = {
    merchantName: bill.merchantName,
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    tipPercent: bill.tipPercent,
    rate: bill.rate,
    status: bill.status,
  }

  async function addPerson(name: string) {
    if (finalizing.current) return
    const result = await writes.run(() =>
      addHostPerson.mutateAsync({ ...hostArgs(), name }),
    )
    setActiveId(result.personId)
  }

  async function removePerson(personId: string) {
    if (finalizing.current) return
    await writes.run(() =>
      removeHostPerson.mutateAsync({ ...hostArgs(), personId }),
    )
  }

  function stepClaim(itemId: string, personId: string, delta: number) {
    if (finalizing.current || (delta !== 1 && delta !== -1)) return
    setConflictMessage(null)
    void writes
      .run(async () => {
        const result = await stepHostClaim.mutateAsync({
          ...hostArgs(),
          personId,
          itemId,
          delta,
        })
        if (result.rejectedCount > 0) {
          setConflictMessage(splitCopy.conflicts.partialClaim)
        }
      })
      .catch(() => {
        setConflictMessage(splitCopy.conflicts.claimFailed)
      })
  }

  function shareEvenly(itemId: string, personIds: string[]) {
    if (finalizing.current) return
    void writes
      .run(() =>
        shareHostItemEvenly.mutateAsync({ ...hostArgs(), itemId, personIds }),
      )
      .catch(() => setConflictMessage(splitCopy.conflicts.shareFailed))
  }

  // One button does it all: flip to PUBLISHED in the background (don't await —
  // the dialog should open on the same tap) and show the QR + share link.
  // navigator.share lives inside the dialog on its own fresh tap, which keeps
  // iOS's user-gesture requirement happy.
  function openInvite() {
    if (!shared) {
      publish.mutate(hostArgs(), {
        onSuccess: () => trackFunnelMilestone('published'),
      })
    }
    setQrOpen(true)
  }

  async function finalizeSplit(splitLeftovers: boolean) {
    if (finalizing.current) return
    finalizing.current = true
    setPreparingFinalize(true)
    try {
      if (!(await writes.wait())) {
        setConflictMessage(splitCopy.conflicts.unsavedEdit)
        setFinalizeOpen(false)
        return
      }
      if (splitLeftovers) await splitLeftoversEvenly.mutateAsync(hostArgs())
      await finalize.mutateAsync(hostArgs())
      setFinalizeOpen(false)
      void navigate({ to: '/summary/$billId', params: { billId } })
    } catch {
      // Mutation errors are displayed by the shared mutation error handler.
    } finally {
      finalizing.current = false
      setPreparingFinalize(false)
    }
  }

  const finalizePending =
    preparingFinalize ||
    writes.pending ||
    finalize.isPending ||
    splitLeftoversEvenly.isPending

  if (!allowedHere) return null

  return (
    <>
      <BillSplitWorkspace
        bill={workspaceBill}
        inviteAction={canEdit && !finalized ? (
          <Button className="h-auto min-h-16 w-full justify-start gap-3 rounded-2xl px-4 py-3 text-left whitespace-normal" onClick={openInvite} disabled={publish.isPending}>
            <RiQrCodeLine aria-hidden className="size-6!" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">{splitCopy.invite.title}</span>
              <span className="mt-0.5 block text-xs font-normal">{splitCopy.invite.hint}</span>
            </span>
            <RiArrowRightLine aria-hidden className="size-5!" />
          </Button>
        ) : undefined}
        description={
          canEdit
            ? splitCopy.description.host
            : finalized
              ? splitCopy.description.finalized
              : splitCopy.description.readOnly
        }
        notice={
          !canEdit ? (
            <ReadOnlyNotice
              shareToken={shared ? bill.shareToken : null}
              finalized={finalized}
            />
          ) : finalized ? (
            <div className="flex items-center gap-2.5 rounded-control bg-muted px-4 py-2.5 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
              <RiLockLine className="size-4 shrink-0" />
              {splitCopy.finalizedLock}
            </div>
          ) : null
        }
        people={bill.people}
        selfId={bill.people.find((p) => p.name === 'self')?.id}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={finalized || !canEdit ? undefined : addPerson}
        onRemove={finalized || !canEdit ? undefined : removePerson}
        onStep={stepClaim}
        onShareEvenly={shareEvenly}
        showClaims={!finalized && canEdit}
        summaryDescription={
          finalized
            ? splitCopy.summaryDescription.finalized
            : canEdit
              ? splitCopy.summaryDescription.host
              : splitCopy.summaryDescription.readOnly
        }
        conflictMessage={conflictMessage}
        onTipChange={
          finalized || !canEdit
            ? undefined
            : (pct) => {
                if (finalizing.current) return
                void writes
                  .run(() =>
                    setTipPercent.mutateAsync({
                      ...hostArgs(),
                      tipPercent: pct,
                    }),
                  )
                  .catch(() => {}) // Shared mutation handler shows the error.
              }
        }
        tipPending={setTipPercent.isPending}
        actionSlot={
          !canEdit ? null : finalized ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                navigate({ to: '/summary/$billId', params: { billId } })
              }
            >
              {splitCopy.actions.viewSummary} <RiArrowRightLine />
            </Button>
          ) : (
            <Button
              size="lg"
              className="min-h-12 w-full"
              variant={allClaimed ? 'default' : 'destructive'}
              onClick={() => setFinalizeOpen(true)}
              disabled={finalizePending}
            >
              <RiLockLine />
              {splitCopy.actions.finalize}
            </Button>
          )
        }
      />
      {/* actionSlot renders in desktop and mobile surfaces. Portaled dialogs
          belong here so only one modal/focus scope mounts per page. */}
      {canEdit && !finalized && (
        <>
          <ShareSplitDialog
            open={qrOpen}
            onOpenChange={setQrOpen}
            title={splitCopy.invite.dialogTitle}
            url={joinUrl(bill.shareToken)}
            merchantName={bill.merchantName}
            onRevoke={
              shared
                ? async () => {
                    await revokeShare.mutateAsync(hostArgs())
                    setQrOpen(false)
                  }
                : undefined
            }
          />

          <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
            <DialogContent className="max-w-sm">
              {allClaimed ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{splitCopy.finalizeDialog.title}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    {splitCopy.finalizeDialog.body}
                  </p>
                  <div className="grid gap-2">
                    <Button
                      size="lg"
                      onClick={() => void finalizeSplit(false)}
                      disabled={finalizePending}
                    >
                      <RiLockLine />
                      {splitCopy.finalizeDialog.confirm}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setFinalizeOpen(false)}
                      disabled={finalizePending}
                    >
                      {splitCopy.finalizeDialog.cancel}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      {splitCopy.finalizeDialog.leftoverTitle}
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatUsd(toUsd(remainingLbp, bill.rate))}
                    </span>{' '}
                    {leftoverItemsPhrase(leftoverItemCount)}{' '}
                    {splitCopy.finalizeDialog.leftoverBodyEnd}
                    {unallocatedServiceLbp > 0
                      ? unallocatedServiceNote(
                          formatUsd(toUsd(unallocatedServiceLbp, bill.rate)),
                        )
                      : ''}
                  </p>
                  <div className="grid gap-2">
                    <Button
                      size="lg"
                      onClick={() => void finalizeSplit(true)}
                      disabled={finalizePending}
                    >
                      <RiGroupLine />
                      {splitCopy.finalizeDialog.splitLeftovers}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => void finalizeSplit(false)}
                      disabled={finalizePending}
                    >
                      {splitCopy.finalizeDialog.finalizeAsIs}
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => setFinalizeOpen(false)}
                      disabled={finalizePending}
                    >
                      {splitCopy.finalizeDialog.keepSplitting}
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}
