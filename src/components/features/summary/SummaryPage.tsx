import { useEffect, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RiChat1Line, RiPieChartLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import {
  BillScreen,
  BillSummary,
  ShareSplitCard,
  ShareSplitDialog,
  SettlementHeader,
  WorkspaceHeader,
} from '~/components/features/bill'
import { ReadOnlyNotice } from '~/components/shared/ReadOnlyNotice'
import { billQueries, useSetHostPersonPaid } from '~/api'
import { getHostToken, recordBill } from '~/lib/session'
import { buildPersonMessage, buildTotalsMessage, joinUrl } from '~/lib/format'
import { settlementProgress } from '~/lib/bill'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { useBillStepGate } from '~/hooks/useBillStepGate'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { SummaryDock, SummarySettlementPanel } from './components/SummaryDock'
import { summaryCopy } from './content'

const DESKTOP = '(min-width: 1024px)'

export function SummaryPage({ billId }: { billId: Id<'bills'> }) {
  const canEdit = useHasHostToken(billId)
  const { data: bill } = useSuspenseQuery(billQueries.detail(billId))
  const allowedHere = useBillStepGate(billId, 'summary', bill)
  const hostArgs = () => ({ id: billId, hostToken: getHostToken(billId) })
  const setHostPersonPaid = useSetHostPersonPaid()
  const [qrOpen, setQrOpen] = useState(false)
  const [sendPendingId, setSendPendingId] = useState<string | null>(null)
  const isDesktop = useMediaQuery(DESKTOP)
  const progress = settlementProgress(bill)
  const link = joinUrl(bill.shareToken)

  async function shareTotalsText() {
    const text = buildTotalsMessage(bill, link)
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

  async function sendPerson(personId: string) {
    const person = bill.people.find((p) => p.id === personId)
    const text = buildPersonMessage(bill, personId, { joinUrl: link })
    setSendPendingId(personId)
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text })
          return
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }
      await navigator.clipboard.writeText(text)
      toast.success(summaryCopy.sendCopied(person?.name.trim() || 'their'))
    } catch {
      toast(text)
    } finally {
      setSendPendingId(null)
    }
  }

  useEffect(() => {
    if (!canEdit) return
    recordBill({ billId, step: 'summary', name: bill.merchantName })
  }, [billId, bill.merchantName, canEdit])

  if (!allowedHere) return null

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
              canEdit
                ? summaryCopy.headerDescription.finalized
                : summaryCopy.headerDescription.readOnly
            }
          />
        }
        notice={
          !canEdit ? (
            <ReadOnlyNotice shareToken={bill.shareToken} finalized />
          ) : undefined
        }
        aside={
          isDesktop ? (
            <aside className="lg:sticky lg:top-6">
              <div className="surface-panel space-y-4 p-4">
                <SettlementHeader
                  progress={progress}
                  travelTotal={false}
                  labels={summaryCopy.header}
                />
                <SummarySettlementPanel
                  rate={bill.rate}
                  tipPercent={bill.tipPercent}
                />
                <Button
                  size="lg"
                  className="w-full min-h-12 active:scale-[0.96]"
                  onClick={() => void shareTotalsText()}
                  disabled={bill.people.length === 0}
                >
                  <RiChat1Line />
                  {summaryCopy.shareAllTotals}
                </Button>
                <section className="surface-card p-4">
                  <h2 className="mb-3 text-center text-sm font-bold text-muted-foreground">
                    {summaryCopy.qrCardTitle}
                  </h2>
                  <ShareSplitCard
                    url={link}
                    merchantName={bill.merchantName}
                  />
                </section>
              </div>
            </aside>
          ) : null
        }
        dock={
          <SummaryDock
            onShareTotals={() => void shareTotalsText()}
            onShowQr={() => setQrOpen(true)}
            shareDisabled={bill.people.length === 0}
            rate={bill.rate}
            tipPercent={bill.tipPercent}
          />
        }
      >
        <SettlementHeader progress={progress} labels={summaryCopy.header} />
        <BillSummary
          bill={bill}
          header={null}
          hideGrandTotal
          sortUnpaidFirst
          nothingClaimedLabel={summaryCopy.nothingClaimed}
          onTogglePaid={
            canEdit
              ? (personId, paid) =>
                  setHostPersonPaid.mutate({ ...hostArgs(), personId, paid })
              : undefined
          }
          paidPendingId={
            setHostPersonPaid.isPending
              ? setHostPersonPaid.variables?.personId
              : null
          }
          onSend={canEdit ? (personId) => void sendPerson(personId) : undefined}
          sendPendingId={sendPendingId}
          sendLabel={summaryCopy.sendAria}
        />
      </BillScreen>

      <ShareSplitDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        title={summaryCopy.qrDialogTitle}
        url={link}
        merchantName={bill.merchantName}
      />
    </>
  )
}
