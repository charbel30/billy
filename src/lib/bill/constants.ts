// Color palette for people chips, handed out round-robin (ui-flow-vision.md).
export const PERSON_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const

// The hexes above are persisted on people in Convex, so they stay the stored
// identity; rendering maps them to the theme's --person-* tokens (app.css) so
// person colors adapt to light/dark. Unknown hexes (legacy data) pass through.
export const PERSON_COLOR_VARS: Record<string, string> = {
  '#ef4444': 'var(--person-1)',
  '#f59e0b': 'var(--person-2)',
  '#10b981': 'var(--person-3)',
  '#3b82f6': 'var(--person-4)',
  '#8b5cf6': 'var(--person-5)',
  '#ec4899': 'var(--person-6)',
  '#14b8a6': 'var(--person-7)',
  '#f97316': 'var(--person-8)',
}

export function personColorValue(hex: string | undefined): string {
  return (hex && PERSON_COLOR_VARS[hex]) ?? hex ?? 'var(--person-fallback)'
}

// Shared "elevated item card" surface — a clear border + layered shadow on
// bg-card. Used across the split / review / summary item & receipt cards so they
// read as distinct, separated cards consistently.
export const ELEVATED_CARD = 'rounded-card border border-border bg-card shadow-card'
export const ELEVATED_CARD_HOVER =
  'hover:border-foreground/15 hover:shadow-card-hover transition-[box-shadow,border-color]'

export const LOW_CONFIDENCE_THRESHOLD = 0.6
export const SAVE_DELAY_MS = 5000
export const DEFAULT_PERSON_NAME = 'self'

// --- Bill domain rules (shared with convex/, like currency.ts) ---

export const MAX_NAME_LENGTH = 48
// Hard ceiling on participants — a leaked share link must not let strangers
// spam a bill with unlimited "people" (the rate limiter slows it, this stops it).
export const MAX_PEOPLE = 30
// New bills start with a 10% tip (the Lebanese norm); older bills have no
// tipPercent and stay tip-free.
export const DEFAULT_TIP_PERCENT = 10
export const MAX_TIP_PERCENT = 30
// Chips offered by the host's tip picker (subset of 0..MAX_TIP_PERCENT).
export const TIP_PRESETS = [0, 5, 10, 15, 20]
