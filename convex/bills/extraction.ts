import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { LineItem } from '../schema'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import { newClientId } from '../../src/lib/bill/ids'
import { reconcile } from '../../src/lib/reconcile'
import { extractedReceiptValidator } from './validators'

const LOW_CONFIDENCE_THRESHOLD = 0.8
// The app keeps money in LBP internally (split + reconcile math are LBP). Real
// LBP prices are 10,000+; anything below this floor is almost certainly a USD
// figure that leaked through as LBP, or a dropped "000". We flag, never auto-fix.
const MIN_PLAUSIBLE_LBP = 1000

export const applyExtraction = internalMutation({
  args: {
    billId: v.id('bills'),
    parsed: extractedReceiptValidator,
  },
  returns: v.null(),
  handler: async (ctx, { billId, parsed: receipt }) => {
    const bill = await ctx.db.get(billId)
    if (!bill) return null

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
      claims: [], // fresh extraction means nothing has been claimed yet
      imageRef: undefined, // delete-after-extract: clear the ref (spec §10)
      extractionError: undefined, // this extraction succeeded
      status:
        checksum.ok && !hasLowConfidence && !hasImplausibleLbp
          ? 'PENDING'
          : 'NEEDS_REVIEW',
      version: bill.version + 1,
      updatedAt: Date.now(),
    })

    return null
  },
})

// The vision call threw or returned unparseable output. Keep the message
// user-safe (the raw error is in the action's logs) and let the review screen
// offer scan-again / manual entry. Only items-less bills are marked — a re-scan
// that fails must not clobber a previously successful extraction's status.
export const markExtractionFailed = internalMutation({
  args: { billId: v.id('bills') },
  returns: v.null(),
  handler: async (ctx, { billId }) => {
    const bill = await ctx.db.get(billId)
    if (!bill) return null
    await ctx.db.patch(billId, {
      extractionError: "We couldn't read this receipt.",
      imageRef: undefined,
      status: bill.lineItems.length > 0 ? bill.status : 'NEEDS_REVIEW',
      version: bill.version + 1,
      updatedAt: Date.now(),
    })
    return null
  },
})
