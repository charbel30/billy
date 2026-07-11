/** Whole numbers plain, fractions to 2dp (e.g. "0.33"). */
export function formatUnits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** LBP amount as a bare grouped number ("1,260,000") — no currency suffix. */
export function formatLbpCompact(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** Relative time for recent-activity lists ("just now", "5m ago", "3d ago"). */
export function timeAgo(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24
  if (d < 7) return `${Math.floor(d)}d ago`
  return new Date(at).toLocaleDateString()
}
