import { metadataError, lineItemsError } from '~/lib/bill/validation'
import { Button } from '~/components/ui/button'
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RiReceiptLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { ReadOnlyNotice } from '~/components/shared/ReadOnlyNotice'
import { BillScreen, WorkspaceHeader } from '~/components/features/bill'
import { useBillEditor } from '~/hooks/useBillEditor'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { billQueries } from '~/api'
import { reconcile } from '~/lib/money'
import { canPersistWorkingBill } from '~/lib/bill'
import { recordBill } from '~/lib/session'
import { trackExtractionOutcome } from '~/lib/observability'
import { AuditLineItems } from './components/AuditLineItems'
import { SettlementSummary } from './components/SettlementSummary'
import { ReviewDock } from './components/ReviewDock'
import {
  ExtractingBanner,
  ExtractionFailedBanner,
} from './components/ExtractionBanners'
import { reviewCopy } from './content'

export function ReviewPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const hasHostAccess = useHasHostToken(billId)
  const { data: serverBill } = useSuspenseQuery(billQueries.detail(billId))
  const canEdit = hasHostAccess && serverBill.status !== 'FINALIZED'
  const editor = useBillEditor(billId, { readOnly: !canEdit })
  const { bill, setMeta, addLineItem, updateLineItem, removeLineItem } = editor
  const { meta } = bill
  // An empty bill is a normal starting point (manual entry, or a scan whose
  // extraction failed) — the screen just has to ask for items instead of
  // asking the user to review nothing.
  const isEmpty = bill.lineItems.length === 0
  const canContinue =
    !isEmpty &&
    canPersistWorkingBill(bill) &&
    !editor.editedElsewhere &&
    !editor.saving
  const validationError = metadataError(meta) ?? lineItemsError(bill.lineItems)
  // Raw server doc (live) — carries extraction failure state the editor's
  // working copy doesn't track.
  const [failureDismissed, setFailureDismissed] = useState(false)
  // The rate chip in the header opens the same panel the dock handle does.
  const [settlementExpanded, setSettlementExpanded] = useState(false)

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

  const description = isEmpty
    ? canEdit
      ? reviewCopy.emptySubhead
      : reviewCopy.readOnlySubhead
    : reviewCopy.subhead

  return (
    <BillScreen
      header={
        <WorkspaceHeader
          merchantName={meta.merchantName}
          status={serverBill.status}
          rate={meta.rate}
          description={description}
          icon={RiReceiptLine}
          onNameCommit={
            canEdit ? (raw) => setMeta({ merchantName: raw }) : undefined
          }
          onRateEdit={canEdit ? () => setSettlementExpanded(true) : undefined}
        />
      }
      notice={
        <>
          {!canEdit ? (
            <ReadOnlyNotice
              shareToken={
                serverBill.status === 'PUBLISHED' ||
                serverBill.status === 'FINALIZED'
                  ? serverBill.shareToken
                  : null
              }
              finalized={serverBill.status === 'FINALIZED'}
            />
          ) : null}
          {validationError ? (
            <Alert variant="warning">
              <AlertTitle>{validationError}</AlertTitle>
            </Alert>
          ) : null}
          {editor.recoveryUnavailable ? (
            <Alert variant="warning">
              <AlertTitle>{reviewCopy.recoveryUnavailable}</AlertTitle>
            </Alert>
          ) : null}
          {editor.editedElsewhere ? (
            <Alert variant="warning">
              <AlertTitle>{reviewCopy.editedElsewhereTitle}</AlertTitle>
              <AlertDescription>
                {reviewCopy.editedElsewhereBody}
              </AlertDescription>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={editor.useServerVersion}>
                  {reviewCopy.useServerVersion}
                </Button>
                {canEdit ? (
                  <Button onClick={editor.keepLocalVersion}>
                    {reviewCopy.keepLocalVersion}
                  </Button>
                ) : null}
              </div>
            </Alert>
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
        </>
      }
      aside={
        <SettlementSummary
          total={recon.computed}
          recon={recon}
          meta={meta}
          onMetaChange={setMeta}
          canContinue={canContinue}
          onContinue={() => void continueToSplit()}
          readOnly={!canEdit}
          saveState={editor.saveState}
          onRetrySave={() => void editor.flushNow()}
        />
      }
      dock={
        canEdit ? (
          <ReviewDock
            total={recon.computed}
            recon={recon}
            meta={meta}
            onMetaChange={setMeta}
            canContinue={canContinue}
            onContinue={() => void continueToSplit()}
            expanded={settlementExpanded}
            onExpandedChange={setSettlementExpanded}
            saveState={editor.saveState}
            onRetrySave={() => void editor.flushNow()}
          />
        ) : undefined
      }
    >
      <section className="surface-card p-4 sm:p-6 lg:p-8">
        <AuditLineItems
          lineItems={bill.lineItems}
          rate={meta.rate}
          onUpdate={updateLineItem}
          onRemove={removeLineItem}
          onAdd={() => addLineItem()}
          readOnly={!canEdit}
        />
      </section>
    </BillScreen>
  )
}
