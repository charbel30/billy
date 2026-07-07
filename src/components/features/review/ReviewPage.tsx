import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RiLoader4Line, RiReceiptLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { useBillEditor } from '~/hooks/useBillEditor'
import { billQueries } from '~/api'
import { reconcile } from '~/lib/reconcile'
import { formatLbp } from '~/lib/currency'
import { parseNumericInput } from '~/lib/number'
import { canPersistWorkingBill } from '~/lib/bill/working'
import { recordBill } from '~/lib/billHistory'
import { RateField } from './RateField'
import { AuditLineItems } from './AuditLineItems'
import { SettlementSummary } from './SettlementSummary'
import { MobileReviewAction } from './MobileReviewAction'
import { ExtractingBanner, ExtractionFailedBanner } from './ExtractionBanners'

export function ReviewPage({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const editor = useBillEditor(billId)
  const { bill, setMeta, addLineItem, updateLineItem, removeLineItem } = editor
  const { meta } = bill
  const canContinue = bill.lineItems.length > 0 && canPersistWorkingBill(bill)
  // Raw server doc (live) — carries extraction failure state the editor's
  // working copy doesn't track.
  const { data: serverBill } = useSuspenseQuery(billQueries.detail(billId))
  const [failureDismissed, setFailureDismissed] = useState(false)

  useEffect(() => {
    recordBill({ billId, step: 'review', name: meta.merchantName })
  }, [billId, meta.merchantName])

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
          Review the scanned items before splitting.
        </p>
      </div>

      {editor.extracting ? <ExtractingBanner /> : null}

      {serverBill.extractionError && !editor.extracting && !failureDismissed ? (
        <ExtractionFailedBanner
          billId={billId}
          onDismiss={() => setFailureDismissed(true)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="rounded-4xl bg-card/80 p-4 shadow-[0_18px_56px_rgba(0,0,0,0.06)] ring-1 ring-border/50 backdrop-blur sm:p-6 lg:p-8">
          <div className="mb-7">
            <div className="min-w-0">
              <BlurCommitInput
                value={meta.merchantName}
                placeholder="Store name"
                onCommit={(raw) => setMeta({ merchantName: raw })}
                className="w-full text-3xl font-black tracking-tight sm:text-4xl"
              />
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <RiReceiptLine className="size-4" />
                Receipt audit
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RateField
              rate={meta.rate}
              onCommit={(raw) =>
                setMeta({ rate: parseNumericInput(raw), rateSource: 'manual' })
              }
            />
            {editor.saving ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                <RiLoader4Line className="size-3.5 animate-spin" />
                Saving
              </span>
            ) : null}
          </div>

          <AuditLineItems
            lineItems={bill.lineItems}
            rate={meta.rate}
            onUpdate={updateLineItem}
            onRemove={removeLineItem}
            onAdd={() => addLineItem()}
          />

          {recon.diff != null && !recon.ok && meta.printedTotalLbp != null ? (
            <p className="mt-4 rounded-3xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Items differ from the printed receipt total by{' '}
              {formatLbp(Math.abs(recon.diff))}. Check the lines above.
            </p>
          ) : null}
        </section>

        <SettlementSummary
          total={recon.computed}
          rate={meta.rate}
          meta={meta}
          onMetaChange={setMeta}
          canContinue={canContinue}
          onContinue={continueToSplit}
        />
      </div>

      <MobileReviewAction
        total={recon.computed}
        rate={meta.rate}
        canContinue={canContinue}
        onContinue={continueToSplit}
      />
    </div>
  )
}
