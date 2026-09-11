import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { Id } from 'convex/_generated/dataModel'
import { getBillHistory, removeBill, clearBillHistory, type BillHistoryEntry } from '~/lib/session'
import { resumeStepFor } from '~/lib/bill/steps'
import { billQueries } from '~/api'
import { RecentScanPanel } from './RecentScanPanel'
import { scanHubCopy } from '../content'

const STEP_TO = {
  review: '/review/$billId',
  split: '/split/$billId',
  summary: '/summary/$billId',
} as const

export function RecentBills() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [history, setHistory] = useState<BillHistoryEntry[]>([])

  useEffect(() => { setHistory(getBillHistory()) }, [])

  if (history.length === 0) return null

  async function openBill(entry: BillHistoryEntry) {
    const billId = entry.billId as Id<'bills'>
    try {
      const bill = await queryClient.ensureQueryData(billQueries.detail(billId))
      const step = resumeStepFor(bill.status)
      await navigate({ to: STEP_TO[step], params: { billId } })
    } catch {
      toast.error(scanHubCopy.resumeFailed)
      removeBill(billId)
      setHistory(getBillHistory())
    }
  }

  return (
    <RecentScanPanel entries={history} onOpen={(entry) => void openBill(entry)} onClear={() => {
      clearBillHistory()
      setHistory([])
    }} />
  )
}
