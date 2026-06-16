/** Whole numbers plain, fractions to 2dp (e.g. "0.33"). */
export function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
