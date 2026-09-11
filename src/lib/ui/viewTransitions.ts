import { STEP_ORDER, type BillStep } from '~/lib/bill/steps'

export type TransitionType = 'step-forward' | 'step-back' | 'takeover' | 'crossfade'

const REVIEW = '/review/'
const SPLIT = '/split/'
const SUMMARY = '/summary/'

export function stepOf(pathname: string): BillStep | null {
  if (pathname.startsWith(REVIEW)) return 'review'
  if (pathname.startsWith(SPLIT)) return 'split'
  if (pathname.startsWith(SUMMARY)) return 'summary'
  return null
}

export function transitionTypes(
  from: string | undefined,
  to: string,
): TransitionType[] {
  if (from === '/' && to.startsWith(REVIEW)) return ['takeover']
  const fromStep = from ? stepOf(from) : null
  const toStep = stepOf(to)
  if (fromStep && toStep && fromStep !== toStep) {
    const fromIdx = STEP_ORDER.indexOf(fromStep)
    const toIdx = STEP_ORDER.indexOf(toStep)
    return toIdx > fromIdx ? ['step-forward'] : ['step-back']
  }
  return ['crossfade']
}
