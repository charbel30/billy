import { RiReceiptLine } from '@remixicon/react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { ReadOnlyNotice } from '~/components/shared/ReadOnlyNotice'
import { BillScreen, WorkspaceHeader } from '~/components/features/bill'
import { metadataError, lineItemsError } from '~/lib/bill/validation'
import { canPersistWorkingBill } from '~/lib/bill'
import type { BillEditor } from '~/lib/bill/types'
import type { ReconcileResult } from '~/lib/money'
import type { BillStatus } from '~/lib/types'
import { revealTailDelay } from '~/lib/ui'
import { useState } from 'react'
import { AuditLineItems } from './AuditLineItems'
import { ReceiptPhotoThumb } from './ReceiptPhotoThumb'
import { ReviewDock } from './ReviewDock'
import { SettlementSummary } from './SettlementSummary'
import { reviewCopy } from '../content'

/** The review screen proper: header, notices, line items, settlement dock. */
export function ReviewEditor({
  editor,
  status,
  shareToken,
  canEdit,
  recon,
  onContinue,
  photoUrl,
  revealed,
}: {
  editor: BillEditor
  status: BillStatus
  shareToken: string | null
  canEdit: boolean
  recon: ReconcileResult
  onContinue: () => void
  /** The scanned photo, while this session still holds it. */
  photoUrl: string | null
  /** This mount is the reveal at the end of a scan — write the receipt in. */
  revealed: boolean
}) {
  const { bill, setMeta, addLineItem, updateLineItem, removeLineItem } = editor
  const { meta } = bill
  // The rate chip in the header opens the same panel the dock handle does.
  const [settlementExpanded, setSettlementExpanded] = useState(false)
  const isEmpty = bill.lineItems.length === 0
  const canContinue =
    !isEmpty &&
    canPersistWorkingBill(bill) &&
    !editor.editedElsewhere &&
    !editor.saving
  const validationError = metadataError(meta) ?? lineItemsError(bill.lineItems)
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
          status={status}
          rate={meta.rate}
          description={description}
          icon={RiReceiptLine}
          onNameCommit={
            canEdit ? (raw) => setMeta({ merchantName: raw }) : undefined
          }
          onRateEdit={canEdit ? () => setSettlementExpanded(true) : undefined}
          trailing={
            photoUrl ? <ReceiptPhotoThumb previewUrl={photoUrl} /> : undefined
          }
        />
      }
      notice={
        <>
          {!canEdit ? (
            <ReadOnlyNotice
              shareToken={shareToken}
              finalized={status === 'FINALIZED'}
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
        </>
      }
      aside={
        <SettlementSummary
          total={recon.computed}
          recon={recon}
          meta={meta}
          onMetaChange={setMeta}
          canContinue={canContinue}
          onContinue={onContinue}
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
            onContinue={onContinue}
            expanded={settlementExpanded}
            onExpandedChange={setSettlementExpanded}
            saveState={editor.saveState}
            onRetrySave={() => void editor.flushNow()}
            revealDelay={
              revealed ? revealTailDelay(bill.lineItems.length) : undefined
            }
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
          animateIn={revealed}
        />
      </section>
    </BillScreen>
  )
}
