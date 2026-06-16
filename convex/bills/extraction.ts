import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { LineItem } from '../schema'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import { newClientId } from '../../src/lib/bill/ids'
import { reconcile } from '../../src/lib/reconcile'
import { extractedReceiptValidator } from './validators'

const LOW_CONFIDENCE_THRESHOLD = 0.8

function primaryPrintedTotal(receipt: {
  currency_primary: string
  printed_total_lbp?: number | null
  printed_total_usd?: number | null
}) {
  return receipt.currency_primary.toUpperCase() === 'USD'
    ? receipt.printed_total_usd
    : receipt.printed_total_lbp
}

export const applyExtraction = internalMutation({
  args: {
    billId: v.id('bills'),
    parsed: extractedReceiptValidator,
  },
  returns: v.null(),
  handler: async (ctx, { billId, parsed: receipt }) => {
    const bill = await ctx.db.get(billId)
    if (!bill) return null

    const items: LineItem[] = receipt.line_items.map((i) => ({
      id: newClientId(),
      name: i.name,
      qty: i.qty,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      confidence: i.confidence,
    }))

    const derived = deriveRate({
      printedTotalLbp: receipt.printed_total_lbp,
      printedTotalUsd: receipt.printed_total_usd,
    })
    const checksum = reconcile({
      lineItems: items,
      serviceCharge: receipt.service_charge,
      tax: receipt.tax,
      printedTotal: primaryPrintedTotal(receipt),
    })
    const hasLowConfidence = items.some(
      (item) =>
        item.confidence !== undefined &&
        item.confidence < LOW_CONFIDENCE_THRESHOLD,
    )

    await ctx.db.patch(billId, {
      merchantName: receipt.merchant ?? bill.merchantName,
      branch: receipt.branch ?? bill.branch,
      datetime: receipt.datetime ?? bill.datetime,
      currencyPrimary: receipt.currency_primary || bill.currencyPrimary || 'LBP',
      serviceCharge: receipt.service_charge,
      tax: receipt.tax,
      printedTotalLbp: receipt.printed_total_lbp ?? undefined,
      printedTotalUsd: receipt.printed_total_usd ?? undefined,
      // Prefer the receipt's own rate (both currency totals printed); otherwise
      // fall back to the 90000 manual knob. No market feed exists yet, so this is
      // 'manual', not 'market'.
      ...(derived
        ? { rate: derived.rate, rateSource: derived.source }
        : { rate: DEFAULT_RATE, rateSource: 'manual' as const }),
      lineItems: items,
      claims: [], // fresh extraction means nothing has been claimed yet
      imageRef: undefined, // delete-after-extract: clear the ref (spec §10)
      status: checksum.ok && !hasLowConfidence ? 'PENDING' : 'NEEDS_REVIEW',
      version: bill.version + 1,
      updatedAt: Date.now(),
    })

    return null
  },
})
