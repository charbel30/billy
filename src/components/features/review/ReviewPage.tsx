import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import type { Id } from 'convex/_generated/dataModel'
import { billQueries, useAbandonExtraction } from '~/api'
import { useBillEditor } from '~/hooks/useBillEditor'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { useScanRunner } from '~/hooks/useScanJob'
import { reconcile } from '~/lib/money'
import { getHostToken, recordBill } from '~/lib/session'
import { softExit } from '~/lib/ui'
import { trackExtractionOutcome } from '~/lib/observability'
import { ProcessingFailed } from './components/ProcessingFailed'
import { ProcessingScreen } from './components/ProcessingScreen'
import { ReviewEditor } from './components/ReviewEditor'
import { useProcessingState } from './hooks/useProcessingState'

/**
 * Review owns the scan wait (ux-flow-and-motion-plan.md §5): the photo the user
 * just took keeps being shown, full screen, until extraction lands — and the
 * editor is not rendered until then, so nothing can bump the bill's version
 * and get the extraction silently discarded.
 *
 * The processing photo and the header thumbnail share one `layoutId`, so they
 * must stay in the same `LayoutGroup`, on this side of `AnimatePresence`.
 */
export function ReviewPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const hasHostAccess = useHasHostToken(billId)
  const { data: serverBill } = useSuspenseQuery(billQueries.detail(billId))
  const canEdit = hasHostAccess && serverBill.status !== 'FINALIZED'
  const editor = useBillEditor(billId, { readOnly: !canEdit })
  const { meta } = editor.bill

  const processing = useProcessingState(billId, serverBill)
  const { rescan } = useScanRunner()
  const abandonExtraction = useAbandonExtraction()
  const [abandoning, setAbandoning] = useState(false)

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
    lineItems: editor.bill.lineItems,
    serviceCharge: meta.serviceChargeOn ? meta.serviceCharge : 0,
    tax: meta.serviceChargeOn ? meta.tax : 0,
    printedTotal: meta.printedTotalLbp ?? null,
  })

  async function continueToSplit() {
    const saved = await editor.flushNow()
    if (!saved) return
    await navigate({ to: '/split/$billId', params: { billId } })
  }

  // Detach the bill from its run before letting anyone type: a late vision
  // result must not land on top of hand-entered items.
  async function enterManually() {
    setAbandoning(true)
    try {
      if (serverBill.imageRef) {
        await abandonExtraction.mutateAsync({
          id: billId,
          hostToken: getHostToken(billId),
        })
      }
      processing.dismissFailure()
    } finally {
      setAbandoning(false)
    }
  }

  return (
    <LayoutGroup>
      <AnimatePresence mode="wait" initial={false}>
        {processing.phase === 'processing' ? (
          <motion.div key="processing" exit={softExit}>
            <ProcessingScreen
              previewUrl={processing.previewUrl}
              stage={processing.stage}
              slowHint={processing.slowHint}
              busy={abandoning}
              onEnterManually={() => void enterManually()}
            />
          </motion.div>
        ) : processing.phase === 'editor' ? (
          <motion.div key="editor">
            <ReviewEditor
              editor={editor}
              status={serverBill.status}
              shareToken={
                serverBill.status === 'PUBLISHED' ||
                serverBill.status === 'FINALIZED'
                  ? serverBill.shareToken
                  : null
              }
              canEdit={canEdit}
              recon={recon}
              onContinue={() => void continueToSplit()}
              photoUrl={processing.previewUrl}
              revealed={processing.revealed}
            />
          </motion.div>
        ) : (
          <motion.div key="failed" exit={softExit}>
            <ProcessingFailed
              variant={processing.phase === 'failed' ? 'failed' : 'photo-lost'}
              previewUrl={processing.previewUrl}
              message={processing.errorMessage}
              busy={abandoning}
              onRescan={(file) => rescan(billId, file)}
              onEnterManually={() => void enterManually()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  )
}
