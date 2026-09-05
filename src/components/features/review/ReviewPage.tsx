import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RiErrorWarningLine, RiReceiptLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { ReadOnlyNotice } from '~/components/shared/ReadOnlyNotice'
import { useBillEditor } from '~/hooks/useBillEditor'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { billQueries } from '~/api'
import { reconcile, formatLbp } from '~/lib/money'
import { parseNumericInput } from '~/lib/format'
import { canPersistWorkingBill } from '~/lib/bill'
import { recordBill } from '~/lib/session'
import { trackExtractionOutcome } from '~/lib/observability'
import { RateField } from './components/RateField'
import { AuditLineItems } from './components/AuditLineItems'
import { SettlementSummary } from './components/SettlementSummary'
import { MobileReviewAction } from './components/MobileReviewAction'
import { ExtractingBanner, ExtractionFailedBanner } from './components/ExtractionBanners'
import { SaveStatus } from './components/SaveStatus'
import { reviewCopy } from './content'

export function ReviewPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const canEdit = useHasHostToken(billId)
  const editor = useBillEditor(billId, { readOnly: !canEdit })
  const { bill, setMeta, addLineItem, updateLineItem, removeLineItem } = editor
  const { meta } = bill
  // An empty bill is a normal starting point (manual entry, or a scan whose
  // extraction failed) — the screen just has to ask for items instead of
  // asking the user to review nothing.
  const isEmpty = bill.lineItems.length === 0
  const canContinue = !isEmpty && canPersistWorkingBill(bill)
  // Raw server doc (live) — carries extraction failure state the editor's
  // working copy doesn't track.
  const { data: serverBill } = useSuspenseQuery(billQueries.detail(billId))
  const [failureDismissed, setFailureDismissed] = useState(false)

  useEffect(() => {
    if (!canEdit) return
    recordBill({ billId, step: 'review', name: meta.merchantName })
  }, [billId, canEdit, meta.merchantName])

  useEffect(() => {
    if (editor.extracting) return
    if (serverBill.extractionError) {
      trackExtractionOutcome(billId, 'failed')
    } else if (serverBill.lineItems.length > 0) {
      trackExtractionOutcome(billId, 'ok')
    }
  }, [
    billId,
    editor.extracting,
    serverBill.extractionError,
    serverBill.lineItems.length,
  ])

  const recon = reconcile({
    lineItems: bill.lineItems,
    serviceCharge: meta.serviceChargeOn ? meta.serviceCharge : 0,
    tax: meta.serviceChargeOn ? meta.tax : 0,
    printedTotal: meta.printedTotalLbp ?? null,
  })

  async function continueToSplit() {
    const saved = await editor.flushNow()
    if (!saved) return
    navigate({ to: '/split/$billId', params: { billId } })
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <div className="mb-6 text-center lg:hidden">
        <p className="text-sm text-muted-foreground">
          {isEmpty
            ? canEdit
              ? reviewCopy.emptySubhead
              : 'This bill does not have any items to show.'
            : reviewCopy.subhead}
        </p>
      </div>

      {!canEdit ? (
        <div className="mb-5">
          <ReadOnlyNotice
            shareToken={
              serverBill.status === 'PUBLISHED' ||
              serverBill.status === 'FINALIZED'
                ? serverBill.shareToken
                : null
            }
            finalized={serverBill.status === 'FINALIZED'}
          />
        </div>
      ) : null}

      {editor.extracting ? <ExtractingBanner /> : null}

      {canEdit &&
      serverBill.extractionError &&
      !editor.extracting &&
      !failureDismissed ? (
        <ExtractionFailedBanner
          billId={billId}
          onDismiss={() => setFailureDismissed(true)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="rounded-card bg-card/80 p-4 shadow-card ring-1 ring-border/50 backdrop-blur sm:p-6 lg:p-8">
          <div className="mb-7">
            <div className="min-w-0">
              <BlurCommitInput
                value={meta.merchantName}
                placeholder="Store name"
                onCommit={(raw) => setMeta({ merchantName: raw })}
                readOnly={!canEdit}
                className="w-full text-3xl font-black tracking-tight sm:text-4xl"
              />
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <RiReceiptLine className="size-4" />
                {isEmpty && canEdit
                  ? reviewCopy.emptyCaption
                  : reviewCopy.caption}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RateField
              rate={meta.rate}
              readOnly={!canEdit}
              onCommit={(raw) =>
                setMeta({ rate: parseNumericInput(raw), rateSource: 'manual' })
              }
            />
            {canEdit ? <SaveStatus saving={editor.saving} /> : null}
          </div>

          <AuditLineItems
            lineItems={bill.lineItems}
            rate={meta.rate}
            onUpdate={updateLineItem}
            onRemove={removeLineItem}
            onAdd={() => addLineItem()}
            readOnly={!canEdit}
          />

          {recon.diff != null && !recon.ok && meta.printedTotalLbp != null ? (
            <Alert variant="warning" className="mt-4">
              <RiErrorWarningLine />
              <AlertTitle>Totals don&apos;t add up</AlertTitle>
              <AlertDescription>
                Items differ from the printed receipt total by{' '}
                <span className="font-receipt font-semibold">
                  {formatLbp(Math.abs(recon.diff))}
                </span>
                . Check the lines above.
              </AlertDescription>
            </Alert>
          ) : null}
        </section>

        <SettlementSummary
          total={recon.computed}
          rate={meta.rate}
          meta={meta}
          onMetaChange={setMeta}
          canContinue={canContinue}
          onContinue={continueToSplit}
          readOnly={!canEdit}
        />
      </div>

      {canEdit ? (
        <MobileReviewAction
          total={recon.computed}
          rate={meta.rate}
          canContinue={canContinue}
          onContinue={continueToSplit}
        />
      ) : null}
    </div>
  )
}
