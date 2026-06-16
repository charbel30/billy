// Arithmetic checksum: the sum of line items (+ service + tax) must reconcile to
// the printed total. The free safety net before anyone splits money (spec §4.3).
// Pure — used both in the browser (review banner) and in Convex (status routing).

// Default tolerance in the bill's primary currency (LBP). A few hundred LL of
// rounding slop is fine; anything larger is a real extraction/occlusion error.
export const DEFAULT_TOLERANCE = 1000

export interface ReconcileInput {
  lineItems: Array<{ lineTotal: number }>
  serviceCharge: number
  tax: number
  /** The printed total in the primary currency. null/undefined when the receipt
   *  doesn't print a total to check against — then there's nothing to reconcile. */
  printedTotal?: number | null
}

export interface ReconcileResult {
  computed: number
  printed: number | null
  /** computed - printed, or null when there's no printed total. */
  diff: number | null
  /** true when within tolerance, or when there's no printed total to check. */
  ok: boolean
}

export function reconcile(
  input: ReconcileInput,
  tolerance: number = DEFAULT_TOLERANCE,
): ReconcileResult {
  const itemsSum = input.lineItems.reduce((sum, li) => sum + (li.lineTotal || 0), 0)
  const computed = itemsSum + (input.serviceCharge || 0) + (input.tax || 0)
  const printed = input.printedTotal ?? null

  if (printed === null) {
    return { computed, printed: null, diff: null, ok: true }
  }

  const diff = computed - printed
  return { computed, printed, diff, ok: Math.abs(diff) <= tolerance }
}
