// Tiny haptics seam for claim taps — cheap delight on Android; a silent no-op
// on iOS Safari (no navigator.vibrate) and during SSR. Never let a vibration
// failure break the tap it decorates.

export function tapHaptic(pattern: number | number[] = 8) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // ignore — haptics are decoration
  }
}
