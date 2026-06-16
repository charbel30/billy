import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import type { LineItem } from '../schema'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import { newClientId } from '../../src/lib/bill/ids'
import { extractedReceiptValidator } from './validators'

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

    await ctx.db.patch(billId, {
      merchantName: receipt.merchant ?? bill.merchantName,
      branch: receipt.branch ?? bill.branch,
      datetime: receipt.datetime ?? bill.datetime,
      currencyPrimary: receipt.currency_primary || bill.currencyPrimary || 'LBP',
      serviceCharge: receipt.service_charge,
      tax: receipt.tax,
      printedTotalLbp: receipt.printed_total_lbp ?? undefined,
      printedTotalUsd: receipt.printed_total_usd ?? undefined,
      ...(derived
        ? { rate: derived.rate, rateSource: derived.source }
        : { rate: DEFAULT_RATE, rateSource: 'market' as const }),
      lineItems: items,
      claims: [], // fresh extraction means nothing has been claimed yet
      imageRef: undefined, // delete-after-extract: clear the ref (spec §10)
      status: 'PENDING',
      version: bill.version + 1,
    })

    return null
  },
})
