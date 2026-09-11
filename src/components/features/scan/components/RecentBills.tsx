import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Id } from 'convex/_generated/dataModel'
import { clearBillHistory, getBillHistory, type BillHistoryEntry } from '~/lib/session'
import { RecentScanPanel } from './RecentScanPanel'

export function RecentBills() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<BillHistoryEntry[]>([])

  useEffect(() => { setHistory(getBillHistory()) }, [])

  if (history.length === 0) return null

  function openBill(entry: BillHistoryEntry) {
    const billId = entry.billId as Id<'bills'>
    const to = entry.step === 'split' ? '/split/$billId'
      : entry.step === 'summary' ? '/summary/$billId' : '/review/$billId'
    void navigate({ to, params: { billId } })
  }

  return (
    <RecentScanPanel entries={history} onOpen={openBill} onClear={() => {
      clearBillHistory()
      setHistory([])
    }} />
  )
}
