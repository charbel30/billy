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

// Shared "elevated item card" surface — a clear border + layered shadow on
// bg-card. Used across the split / review / summary item & receipt cards so they
// read as distinct, separated cards consistently.
export const ELEVATED_CARD =
  'border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_30px_rgba(0,0,0,0.10)]'
export const ELEVATED_CARD_HOVER =
  'hover:border-foreground/20 hover:shadow-[0_2px_6px_rgba(0,0,0,0.10),0_18px_44px_rgba(0,0,0,0.14)]'

export const DEFAULT_PERSON_COLOR = '#999'
export const LOW_CONFIDENCE_THRESHOLD = 0.6
export const SAVE_DELAY_MS = 5000
export const DEFAULT_PERSON_NAME = 'self'
