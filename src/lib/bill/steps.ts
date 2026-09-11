import type { BillStatus } from '~/lib/types'

export type BillStep = 'review' | 'split' | 'summary'

export const STEP_ORDER = ['review', 'split', 'summary'] as const

export const STEP_PATH = {
  review: '/review/$billId',
  split: '/split/$billId',
  summary: '/summary/$billId',
} as const

export interface StepAvailability {
  enabled: boolean
  reason?: string
}

const SPLIT_EXTRACTING = 'Still reading the receipt'
const SPLIT_EMPTY = 'Add items first'
const SUMMARY_LOCKED = 'Finalize the split to unlock'

/** Which bill steps are reachable from the current document. */
export function stepAvailability(bill: {
  status: BillStatus
  lineItems: { length: number }
  imageRef?: string | null
}): Record<BillStep, StepAvailability> {
  const extracting = Boolean(bill.imageRef)
  const empty = bill.lineItems.length === 0
  return {
    review: { enabled: true },
    split: extracting
      ? { enabled: false, reason: SPLIT_EXTRACTING }
      : empty
        ? { enabled: false, reason: SPLIT_EMPTY }
        : { enabled: true },
    summary:
      bill.status === 'FINALIZED'
        ? { enabled: true }
        : { enabled: false, reason: SUMMARY_LOCKED },
  }
}

/** Where "Continue" / recent-bills should land for this lifecycle status. */
export function resumeStepFor(status: BillStatus): BillStep {
  if (status === 'FINALIZED') return 'summary'
  if (status === 'READY' || status === 'PUBLISHED') return 'split'
  return 'review'
}

/** Highest enabled step at or before the one the user asked for. */
export function highestEnabledStep(
  requested: BillStep,
  availability: Record<BillStep, StepAvailability>,
): BillStep {
  const requestedIdx = STEP_ORDER.indexOf(requested)
  for (let i = requestedIdx; i >= 0; i--) {
    const step = STEP_ORDER[i]
    if (availability[step].enabled) return step
  }
  return 'review'
}
