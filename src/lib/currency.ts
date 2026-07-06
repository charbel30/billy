// Currency logic (spec §2.2, §5). Most Lebanese receipts print BOTH a LBP and a
// USD total, so the venue's own rate is on the paper: rate = total_lbp / total_usd.
// We store every amount in its original currency plus the rate + source, so the
// other currency is always reproducible. Pure — no React/Convex imports.

import type { RateSource } from './types'

// Baked-in parallel-market rate (LBP per USD) used until a receipt carries its own
// rate or the user overrides it. Temporary: replace with the Phase-2 market feed.
export const DEFAULT_RATE = 90000

// Plausibility band for a derived LBP/USD rate. The real 2026 rate is ~90,000;
// the band is wide so lira drift doesn't break it, but tight enough to catch
// order-of-magnitude extraction errors (a "$77.00" total misread as 7700 makes
// the ratio ~900 — off by 100x, never a real rate).
export const MIN_PLAUSIBLE_RATE = 20_000
export const MAX_PLAUSIBLE_RATE = 500_000

/** Derive the rate from the receipt's printed totals when both are present.
 *  Returns null when only one (or neither) total is printed, or when the
 *  implied ratio is outside the plausible band (a misread total) — the caller
 *  then falls back to a market rate (Phase 2) or manual entry. */
export function deriveRate(args: {
  printedTotalLbp?: number | null
  printedTotalUsd?: number | null
}): { rate: number; source: RateSource } | null {
  const { printedTotalLbp, printedTotalUsd } = args
  if (
    printedTotalLbp != null &&
    printedTotalUsd != null &&
    printedTotalUsd > 0
  ) {
    const rate = printedTotalLbp / printedTotalUsd
    if (rate < MIN_PLAUSIBLE_RATE || rate > MAX_PLAUSIBLE_RATE) return null
    return { rate, source: 'receipt' }
  }
  return null
}

/** Convert an LBP amount to USD at the given rate (LBP per USD). */
export function toUsd(lbp: number, rate: number | null | undefined): number {
  if (!rate) return 0
  return lbp / rate
}

/** Convert a USD amount to LBP at the given rate (LBP per USD). */
export function toLbp(usd: number, rate: number | null | undefined): number {
  if (!rate) return 0
  return usd * rate
}

/** Format LBP: thousands separators, no decimals (spec §4.2). */
export function formatLbp(lbp: number): string {
  return `${Math.round(lbp).toLocaleString('en-US')} LL`
}

/** Format USD: leading symbol, 2 decimals. */
export function formatUsd(usd: number): string {
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
