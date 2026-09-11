import { useEffect, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiChat1Line, RiInformationLine, RiPieChartLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import { Alert, AlertTitle } from '~/components/ui/alert'
import {
  BillScreen,
  BillSummary,
  ShareSplitCard,
  ShareSplitDialog,
  WorkspaceHeader,
} from '~/components/features/bill'
import { ReadOnlyNotice } from '~/components/shared/ReadOnlyNotice'
import { billQueries, useRevokeShare, useSetHostPersonPaid } from '~/api'
import { getHostToken, recordBill } from '~/lib/session'
import { buildTotalsMessage, joinUrl } from '~/lib/format'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { SummaryDock } from './components/SummaryDock'
import { summaryCopy } from './content'

export function SummaryPage({ billId }: { billId: Id<'bills'> }) {
  const canEdit = useHasHostToken(billId)
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
  // Host writes carry the bill's capability, not just its id (the id is right
  // there in the URL). Read at call time so it's always the current value.
  const hostArgs = () => ({ id: billId, hostToken: getHostToken(billId) })
  const revokeShare = useRevokeShare()
  const setHostPersonPaid = useSetHostPersonPaid()
  const [qrOpen, setQrOpen] = useState(false)
  const finalized = bill.status === 'FINALIZED'
  const shared = bill.status === 'PUBLISHED' || finalized

  async function shareTotalsText() {
    const text = buildTotalsMessage(
      bill,
      shared ? joinUrl(bill.shareToken) : null,
    )
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(summaryCopy.totalsCopied)
    } catch {
      toast(text)
    }
  }

  useEffect(() => {
    if (!canEdit) return
    recordBill({ billId, step: 'summary', name: bill.merchantName })
  }, [billId, bill.merchantName, canEdit])

  const revoke =
    finalized || !canEdit
      ? undefined
      : async () => {
          await revokeShare.mutateAsync(hostArgs())
        }

  return (
    <>
      <BillScreen
        header={
          <WorkspaceHeader
            merchantName={bill.merchantName}
            status={bill.status}
            rate={bill.rate}
            icon={RiPieChartLine}
            description={
              !canEdit
                ? summaryCopy.headerDescription.readOnly
                : finalized
                  ? summaryCopy.headerDescription.finalized
                  : summaryCopy.headerDescription.preview
            }
          />
        }
        notice={
          <>
            {!canEdit ? (
              <ReadOnlyNotice
                shareToken={shared ? bill.shareToken : null}
                finalized={finalized}
              />
            ) : null}
            {!finalized && canEdit ? (
              <Alert variant="info">
                <RiInformationLine />
                <AlertTitle>{summaryCopy.livePreview}</AlertTitle>
              </Alert>
            ) : null}
          </>
        }
        aside={
          /* Desktop keeps the share actions in a column; Phase E replaces this
             with the dock's own panel content. */
          <aside className="hidden lg:sticky lg:top-6 lg:block">
            <div className="space-y-4">
              <Button
                size="lg"
                className="w-full"
                onClick={() => void shareTotalsText()}
                disabled={bill.people.length === 0}
              >
                <RiChat1Line />
                {summaryCopy.shareTotals}
              </Button>
              {shared ? (
                <section className="surface-card p-4">
                  <h2 className="mb-3 text-center text-sm font-bold text-muted-foreground">
                    {finalized
                      ? summaryCopy.qrCardTitle.finalized
                      : summaryCopy.qrCardTitle.live}
                  </h2>
                  <ShareSplitCard
                    url={joinUrl(bill.shareToken)}
                    merchantName={bill.merchantName}
                    onRevoke={revoke}
                  />
                </section>
              ) : null}
            </div>
          </aside>
        }
        dock={
          <SummaryDock
            onShareTotals={() => void shareTotalsText()}
            onShowQr={shared ? () => setQrOpen(true) : undefined}
            shareDisabled={bill.people.length === 0}
          />
        }
      >
        <BillSummary
          bill={bill}
          title={bill.merchantName || summaryCopy.receiptTitle}
          description={
            finalized
              ? summaryCopy.receiptDescription.finalized
              : summaryCopy.receiptDescription.preview
          }
          onTogglePaid={
            shared && canEdit
              ? (personId, paid) =>
                  setHostPersonPaid.mutate({ ...hostArgs(), personId, paid })
              : undefined
          }
          paidPendingId={
            setHostPersonPaid.isPending
              ? setHostPersonPaid.variables?.personId
              : null
          }
        />
      </BillScreen>

      {/* Portaled dialog lives outside the screen frame so only one modal /
          focus scope mounts per page. */}
      {shared ? (
        <ShareSplitDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          title={summaryCopy.qrDialogTitle}
          url={joinUrl(bill.shareToken)}
          merchantName={bill.merchantName}
          onRevoke={
            revoke
              ? async () => {
                  await revoke()
                  setQrOpen(false)
                }
              : undefined
          }
        />
      ) : null}
    </>
  )
}
