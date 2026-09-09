import type { LineItem } from '../types'

// Generous receipt limits keep arithmetic finite and accidental extra zeroes visible.
export const MAX_LBP_AMOUNT = 1_000_000_000_000
export const MAX_EXCHANGE_RATE = 1_000_000_000
export const MAX_RECEIPT_ITEMS = 300
export const MAX_ITEM_QUANTITY = 10_000

type MonetaryMeta = {
  currencyPrimary: string
  rate?: number | null
  serviceCharge: number
  tax: number
  printedTotalLbp?: number | null
  printedTotalUsd?: number | null
  merchantName?: string
  branch?: string
  datetime?: string
}

export function metadataError(meta: MonetaryMeta): string | null {
  if (meta.currencyPrimary !== 'LBP')
    return 'Receipt amounts must be stored in LBP.'
  if (
    meta.rate == null ||
    !Number.isFinite(meta.rate) ||
    meta.rate < 1 ||
    meta.rate > MAX_EXCHANGE_RATE
  ) {
    return `Enter an exchange rate between 1 and ${MAX_EXCHANGE_RATE.toLocaleString('en-US')} LL per USD.`
  }
  for (const [label, value, max] of [
    ['Service charge', meta.serviceCharge, MAX_LBP_AMOUNT],
    ['Tax', meta.tax, MAX_LBP_AMOUNT],
    ['Printed LBP total', meta.printedTotalLbp, MAX_LBP_AMOUNT],
    ['Printed USD total', meta.printedTotalUsd, MAX_LBP_AMOUNT],
  ] as const) {
    if (
      value != null &&
      (!Number.isFinite(value) || value < 0 || value > max)
    ) {
      return `${label} must be a nonnegative amount no greater than ${max.toLocaleString('en-US')}.`
    }
  }
  if (
    [meta.merchantName, meta.branch, meta.datetime].some(
      (text) => text != null && text.length > 200,
    )
  ) {
    return 'Receipt details must be 200 characters or fewer.'
  }
  return null
}

export function lineItemsError(items: LineItem[]): string | null {
  if (items.length > MAX_RECEIPT_ITEMS)
    return `Use at most ${MAX_RECEIPT_ITEMS} receipt lines.`
  const ids = new Set<string>()
  let total = 0
  for (const item of items) {
    if (!item.id || item.id.length > 200 || ids.has(item.id))
      return 'Each receipt line needs a unique ID.'
    ids.add(item.id)
    if (!item.name.trim() || item.name.length > 200)
      return 'Each item needs a name of 1–200 characters.'
    if (
      !Number.isFinite(item.qty) ||
      item.qty <= 0 ||
      item.qty > MAX_ITEM_QUANTITY
    )
      return `Item quantities must be greater than 0 and at most ${MAX_ITEM_QUANTITY}.`
    if (
      [item.unitPrice, item.lineTotal].some(
        (n) => !Number.isFinite(n) || n < 0 || n > MAX_LBP_AMOUNT,
      )
    )
      return 'Item amounts must be finite, nonnegative, and within the receipt limit.'
    if (
      item.confidence != null &&
      (!Number.isFinite(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1)
    )
      return 'Item confidence must be between 0 and 1.'
    total += item.lineTotal
  }
  return total > MAX_LBP_AMOUNT
    ? 'The receipt total exceeds the supported limit.'
    : null
}
