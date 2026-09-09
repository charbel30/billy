import { metadataError, lineItemsError } from '../../src/lib/bill/validation'
import { runIdValidator, runResultValidator } from '@convex-dev/action-retrier'
import { v } from 'convex/values'
import { internalMutation, type MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import * as imageStore from '../lib/imageStore'
import type { LineItem } from '../schema'
import { deleteClaimRowsForBill } from '../model/claimRows'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/money/currency'
import { newClientId } from '../../src/lib/bill/ids'
import { reconcile } from '../../src/lib/money/reconcile'
import { extractedReceiptValidator } from './lib/validators'

const LOW_CONFIDENCE_THRESHOLD = 0.8
// The app keeps money in LBP internally (split + reconcile math are LBP). Real
// LBP prices are 10,000+; anything below this floor is almost certainly a USD
// figure that leaked through as LBP, or a dropped "000". We flag, never auto-fix.
const MIN_PLAUSIBLE_LBP = 1000

export const applyExtraction = internalMutation({
  args: {
    billId: v.id('bills'),
    imageRef: v.string(),
    parsed: extractedReceiptValidator,
  },
  returns: v.null(),
  handler: async (ctx, { billId, imageRef, parsed: receipt }) => {
    const bill = await ctx.db.get(billId)
    if (!bill) return null
    // A second scan can supersede a run while its model request is in flight.
    // Never let that older result clear or overwrite the newer image/run.
    if (bill.imageRef !== imageRef) return null
    if (!canApplyExtraction(bill)) {
      await clearExtraction(ctx, bill)
      return null
    }
    if (!['USD', 'LBP'].includes(receipt.currency_primary.toUpperCase())) {
      await markExtractionFailed(ctx, bill)
      return null
    }

    // Normalize to LBP at the boundary. A USD-printed receipt has small dollar
    // figures ($17) that the LBP-internal split/reconcile would otherwise read as
    // 17 LL. Convert each amount at the receipt's own rate (both totals printed),
    // else the manual fallback rate. USD round-trips back via toUsd at display.
    const derived = deriveRate({
      printedTotalLbp: receipt.printed_total_lbp,
      printedTotalUsd: receipt.printed_total_usd,
    })
    const rate = derived?.rate ?? DEFAULT_RATE
    const isUsdPrimary = receipt.currency_primary.toUpperCase() === 'USD'
    const toLbp = (n: number) => (isUsdPrimary ? n * rate : n)

    const items: LineItem[] = receipt.line_items.map((i) => ({
      id: newClientId(),
      name: i.name,
      qty: i.qty,
      unitPrice: toLbp(i.unit_price),
      lineTotal: toLbp(i.line_total),
      confidence: i.confidence,
    }))
    const serviceCharge = toLbp(receipt.service_charge)
    const tax = toLbp(receipt.tax)

    // Store both printed totals as LBP-comparable values so the review-page
    // checksum (which reconciles against printedTotalLbp) works for USD receipts.
    const printedTotalLbp =
      receipt.printed_total_lbp ??
      (receipt.printed_total_usd != null
        ? receipt.printed_total_usd * rate
        : undefined)
    const printedTotalUsd = receipt.printed_total_usd ?? undefined

    const invalid =
      lineItemsError(items) ??
      metadataError({
        currencyPrimary: 'LBP',
        rate,
        serviceCharge,
        tax,
        printedTotalLbp,
        printedTotalUsd,
        merchantName: receipt.merchant,
        branch: receipt.branch,
        datetime: receipt.datetime,
      })
    if (invalid || items.length === 0) {
      await markExtractionFailed(ctx, bill)
      return null
    }

    const checksum = reconcile({
      lineItems: items,
      serviceCharge,
      tax,
      printedTotal: printedTotalLbp ?? null,
    })
    const hasLowConfidence = items.some(
      (item) =>
        item.confidence !== undefined &&
        item.confidence < LOW_CONFIDENCE_THRESHOLD,
    )
    const hasImplausibleLbp = items.some(
      (item) => item.lineTotal > 0 && item.lineTotal < MIN_PLAUSIBLE_LBP,
    )
    // Both totals printed but deriveRate refused the ratio: one of them was
    // misread (e.g. "$77.00" as 7700). The review screen is where that gets
    // fixed, so never let such a bill ship as PENDING with the fallback rate.
    const hasImplausibleRate =
      receipt.printed_total_lbp != null &&
      receipt.printed_total_usd != null &&
      derived === null

    await ctx.db.patch(billId, {
      merchantName: receipt.merchant ?? bill.merchantName,
      branch: receipt.branch ?? bill.branch,
      datetime: receipt.datetime ?? bill.datetime,
      // Amounts are now LBP regardless of how the receipt was printed, so the
      // internal unit of record is LBP. (rateSource still records its origin.)
      currencyPrimary: 'LBP',
      serviceCharge,
      tax,
      printedTotalLbp,
      printedTotalUsd,
      // Prefer the receipt's own rate (both currency totals printed); otherwise
      // fall back to the manual knob. No market feed exists yet, so 'manual'.
      ...(derived
        ? { rate: derived.rate, rateSource: derived.source }
        : { rate: DEFAULT_RATE, rateSource: 'manual' as const }),
      lineItems: items,
      imageRef: undefined, // delete-after-extract: clear the ref (spec §10)
      extractionError: undefined, // this extraction succeeded
      extractionBaseVersion: undefined,
      extractionRunId: undefined, // run resolved; onComplete becomes a no-op
      status:
        checksum.ok &&
        !hasLowConfidence &&
        !hasImplausibleLbp &&
        !hasImplausibleRate
          ? 'PENDING'
          : 'NEEDS_REVIEW',
      version: bill.version + 1,
      updatedAt: Date.now(),
    })
    // Fresh extraction means nothing has been claimed yet — clear any rows a
    // re-scan may have inherited from the bill's previous items.
    await deleteClaimRowsForBill(ctx, billId)

    return null
  },
})

// The vision call threw or returned unparseable output on every retry. Keep the
// message user-safe (raw errors are in the action's logs) and let the review
// screen offer scan-again / manual entry. Only items-less bills are marked — a
// re-scan that fails must not clobber a previously successful extraction's status.
function canApplyExtraction(bill: Doc<'bills'>) {
  return (
    bill.status !== 'PUBLISHED' &&
    bill.status !== 'FINALIZED' &&
    bill.extractionBaseVersion !== undefined &&
    bill.version === bill.extractionBaseVersion
  )
}

async function clearExtraction(ctx: MutationCtx, bill: Doc<'bills'>) {
  await ctx.db.patch(bill._id, {
    imageRef: undefined,
    extractionRunId: undefined,
    extractionBaseVersion: undefined,
  })
}

async function markExtractionFailed(ctx: MutationCtx, bill: Doc<'bills'>) {
  if (!canApplyExtraction(bill)) {
    await clearExtraction(ctx, bill)
    return
  }
  await ctx.db.patch(bill._id, {
    extractionError: "We couldn't read this receipt.",
    imageRef: undefined,
    extractionRunId: undefined,
    extractionBaseVersion: undefined,
    status: bill.lineItems.length > 0 ? bill.status : 'NEEDS_REVIEW',
    version: bill.version + 1,
    updatedAt: Date.now(),
  })
}

// Action-retrier callback for extractReceipt runs (see attachImageAndExtract).
// Success is a no-op — applyExtraction already updated the bill and cleared the
// run id, so the lookup misses. Final failure surfaces the error and honors
// delete-after-extract (the retry path keeps the image alive between attempts).
export const onExtractionComplete = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  returns: v.null(),
  handler: async (ctx, { runId, result }) => {
    const bill = await ctx.db
      .query('bills')
      .withIndex('by_extractionRunId', (q) => q.eq('extractionRunId', runId))
      .unique()
    if (!bill) return null // extraction succeeded, bill purged, or run superseded

    if (result.type === 'success') {
      await clearExtraction(ctx, bill)
      return null
    }

    const imageRef = bill.imageRef
    await markExtractionFailed(ctx, bill)
    if (imageRef) {
      try {
        await imageStore.deleteImage(ctx, imageRef)
      } catch (error) {
        console.error('[privacy] failed to delete failed receipt upload', {
          imageRef,
          error: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }
    return null
  },
})
