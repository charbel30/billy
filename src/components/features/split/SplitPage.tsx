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
import { BillSplitWorkspace, ShareSplitCard } from '~/components/features/bill'
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
import { remainingUnits, totalRemainingLbp, formatUsd, toUsd } from '~/lib/money'
import { joinUrl } from '~/lib/format'
import { trackFunnelMilestone } from '~/lib/observability'

export function SplitPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const canEdit = useHasHostToken(billId)
  // Host writes carry the bill's capability, not just its id (the id is right
  // there in the URL). Read at call time so it's always the current value.
  const hostArgs = () => ({ id: billId, hostToken: getHostToken(billId) })
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
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
    const result = await writes.run(() => addHostPerson.mutateAsync({ ...hostArgs(), name }))
    setActiveId(result.personId)
  }

  async function removePerson(personId: string) {
    if (finalizing.current) return
    await writes.run(() => removeHostPerson.mutateAsync({ ...hostArgs(), personId }))
  }

  function stepClaim(itemId: string, personId: string, delta: number) {
    if (finalizing.current || (delta !== 1 && delta !== -1)) return
    setConflictMessage(null)
    void writes.run(async () => {
      const result = await stepHostClaim.mutateAsync({ ...hostArgs(), personId, itemId, delta })
      if (result.rejectedCount > 0) {
        setConflictMessage('Some units were already claimed, so we kept only what was still available.')
      }
    }).catch(() => {
      setConflictMessage('That claim could not be saved. Please try again.')
    })
  }

  function shareEvenly(itemId: string, personIds: string[]) {
    if (finalizing.current) return
    void writes.run(() => shareHostItemEvenly.mutateAsync({ ...hostArgs(), itemId, personIds }))
      .catch(() => setConflictMessage('That split could not be saved. Please try again.'))
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
        setConflictMessage('An edit could not be saved. Check the split before finalizing.')
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
    preparingFinalize || writes.pending || finalize.isPending || splitLeftoversEvenly.isPending

  return (
    <>
      <BillSplitWorkspace
        bill={workspaceBill}
        description={
          canEdit
            ? 'Pick a person, claim their items, and invite everyone from this same screen.'
            : finalized
              ? 'A read-only view of the finalized receipt.'
              : 'A read-only view of the live split.'
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
              This split is finalized, so edits are locked for everyone.
            </div>
          ) : null
        }
        people={bill.people}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={finalized || !canEdit ? undefined : addPerson}
        onRemove={finalized || !canEdit ? undefined : removePerson}
        onStep={stepClaim}
        onShareEvenly={shareEvenly}
        showClaims={!finalized && canEdit}
        summaryDescription={
          finalized
            ? 'This split is finalized and read-only.'
            : canEdit
              ? 'Updates live as people claim items.'
              : 'View only. The split can still change on the host device.'
        }
        conflictMessage={conflictMessage}
        onTipChange={
          finalized || !canEdit
            ? undefined
            : (pct) => {
                if (finalizing.current) return
                void writes.run(() => setTipPercent.mutateAsync({ ...hostArgs(), tipPercent: pct }))
                  .catch(() => {}) // Shared mutation handler shows the error.
              }
        }
        tipPending={setTipPercent.isPending}
        actionSlot={
          !canEdit ? null : finalized ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate({ to: '/summary/$billId', params: { billId } })}
            >
              View final summary <RiArrowRightLine />
            </Button>
          ) : (
            <>
              {/* Two actions side by side keeps the mobile dock short. When
                  everything is claimed, Finalize takes over as the primary. */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  variant={allClaimed ? 'outline' : 'default'}
                  onClick={openInvite}
                  disabled={publish.isPending}
                >
                  <RiQrCodeLine />
                  Invite
                </Button>
                <Button
                  size="lg"
                  variant={allClaimed ? 'default' : 'destructive'}
                  onClick={() => setFinalizeOpen(true)}
                  disabled={finalizePending}
                >
                  <RiLockLine />
                  Finalize
                </Button>
              </div>
            </>
          )
        }
      />
      {/* actionSlot renders in desktop and mobile surfaces. Portaled dialogs
          belong here so only one modal/focus scope mounts per page. */}
      {canEdit && !finalized && (
        <>
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Scan to join the split</DialogTitle>
              </DialogHeader>
              <ShareSplitCard
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
            </DialogContent>
          </Dialog>

          <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
            <DialogContent className="max-w-sm">
              {allClaimed ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Finalize this split?</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    This locks edits for everyone and turns the summary into
                    a read-only receipt.
                  </p>
                  <div className="grid gap-2">
                    <Button
                      size="lg"
                      onClick={() => void finalizeSplit(false)}
                      disabled={finalizePending}
                    >
                      <RiLockLine />
                      Finalize split
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setFinalizeOpen(false)}
                      disabled={finalizePending}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Some items are still unclaimed</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatUsd(toUsd(remainingLbp, bill.rate))}
                    </span>{' '}
                    across {leftoverItemCount}{' '}
                    {leftoverItemCount === 1 ? 'item' : 'items'} has no owner
                    yet. Split it evenly, or finalize with it left off
                    everyone's totals.
                  </p>
                  <div className="grid gap-2">
                    <Button
                      size="lg"
                      onClick={() => void finalizeSplit(true)}
                      disabled={finalizePending}
                    >
                      <RiGroupLine />
                      Split leftovers evenly
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => void finalizeSplit(false)}
                      disabled={finalizePending}
                    >
                      Finalize as is
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => setFinalizeOpen(false)}
                      disabled={finalizePending}
                    >
                      Keep splitting
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
