const fractionGlyphs: Record<string, string> = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
  '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
}

/** Preserve recognizable shares without rounding the stored quantity. */
export function formatUnits(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Math.abs(n - Math.round(n)) < 1e-8) return String(Math.round(n))
  const sign = n < 0 ? '−' : ''
  const whole = Math.floor(Math.abs(n))
  const fraction = Math.abs(n) - whole
  for (let denominator = 2; denominator <= 30; denominator++) {
    const numerator = Math.round(fraction * denominator)
    if (numerator > 0 && numerator < denominator && Math.abs(fraction - numerator / denominator) < 1e-8) {
      const key = `${numerator}/${denominator}`
      const glyph = fractionGlyphs[key]
      return `${sign}${whole ? `${whole}${glyph ? '' : ' '}` : ''}${glyph ?? key}`
    }
  }
  return n.toFixed(2)
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
