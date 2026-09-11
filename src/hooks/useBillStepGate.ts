import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import type { BillStatus } from '~/lib/types'
import {
  highestEnabledStep,
  stepAvailability,
  STEP_PATH,
  type BillStep,
} from '~/lib/bill/steps'

/** Client-side complement to the route `beforeLoad` gate (SSR can't read hostToken). */
export function useBillStepGate(
  billId: Id<'bills'>,
  requested: BillStep,
  bill: {
    status: BillStatus
    lineItems: { length: number }
    imageRef?: string | null
  },
) {
  const navigate = useNavigate()
  const dest = highestEnabledStep(requested, stepAvailability(bill))
  const allowed = dest === requested

  useEffect(() => {
    if (allowed) return
    void navigate({ to: STEP_PATH[dest], params: { billId }, replace: true })
  }, [allowed, billId, dest, navigate])

  return allowed
}
