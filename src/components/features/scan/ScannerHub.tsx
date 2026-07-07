import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateDemoBill } from '~/api'
import { scanErrorMessage, useScanUpload } from './hooks/useScanUpload'
import { getDeviceId } from '~/lib/deviceId'
import type { Id } from 'convex/_generated/dataModel'
import {
  clearBillHistory,
  getBillHistory,
  type BillHistoryEntry,
} from '~/lib/billHistory'
import { LegalFooter } from '~/components/shared/LegalFooter'
import { ScannerViewfinder } from './ScannerViewfinder'
import { ScanActions } from './ScanActions'
import { ResumeBillCard } from './ResumeBillCard'
import { RecentScanPanel } from './RecentScanPanel'
import { scanHubCopy } from './content'
import '@fontsource-variable/figtree/wght.css'

export function ScannerHub() {
  const navigate = useNavigate()
  const scan = useScanUpload()
  const createDemoBill = useCreateDemoBill()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  // Photo picked but not yet confirmed — extraction is a paid call, so the
  // user gets one look ("readable? whole receipt in frame?") before we send it.
  const [pending, setPending] = useState<{ file: File; url: string } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<BillHistoryEntry[]>([])
  const busy = scan.busy || createDemoBill.isPending

  // Read local bill history on mount (client-only / localStorage).
  useEffect(() => {
    setHistory(getBillHistory())
  }, [])

  const lastBill = history[0] ?? null

  function startScan() {
    if (busy) return
    cameraInputRef.current?.click()
  }

  function openBill(entry: BillHistoryEntry) {
    const billId = entry.billId as Id<'bills'>
    if (entry.step === 'split')
      navigate({ to: '/split/$billId', params: { billId } })
    else if (entry.step === 'summary')
      navigate({ to: '/summary/$billId', params: { billId } })
    else navigate({ to: '/review/$billId', params: { billId } })
  }

  function clearHistory() {
    clearBillHistory()
    setHistory([])
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
    if (!file) return
    setError(null)
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { file, url: URL.createObjectURL(file) }
    })
  }

  function retake() {
    if (busy) return
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    cameraInputRef.current?.click()
  }

  async function confirmPhoto() {
    if (!pending || busy) return
    setError(null)
    try {
      const billId = await scan.scanNew(pending.file)
      URL.revokeObjectURL(pending.url)
      setPending(null)
      navigate({ to: '/review/$billId', params: { billId } })
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    }
  }

  async function trySampleBill() {
    if (busy) return
    setError(null)
    try {
      const billId = await createDemoBill.mutateAsync({
        deviceId: getDeviceId(),
      })
      navigate({ to: '/review/$billId', params: { billId } })
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    }
  }

  return (
    <div
      className="min-h-full bg-background px-4 pb-8 pt-4 text-foreground sm:px-6 md:px-10 md:pb-12"
      style={{ fontFamily: '"Figtree Variable", var(--font-sans)' }}
    >
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={handleFile}
      />

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 md:max-w-5xl">
        {lastBill ? <ResumeBillCard entry={lastBill} onOpen={openBill} /> : null}

        <main className="grid gap-6 md:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] md:items-start md:justify-center">
          <section className="space-y-5">
            <ScannerViewfinder busy={busy} previewUrl={pending?.url ?? null} />

            <ScanActions
              hasPending={pending !== null}
              busy={busy}
              onConfirm={() => void confirmPhoto()}
              onRetake={retake}
              onStartScan={startScan}
              onTrySample={() => void trySampleBill()}
            />

            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          </section>

          <RecentScanPanel
            entries={history}
            onOpen={openBill}
            onClear={clearHistory}
          />
        </main>

        <LegalFooter />
      </div>
    </div>
  )
}
