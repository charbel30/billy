import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateDemoBill } from '~/api'
import { scanErrorMessage, useScanUpload } from './hooks/useScanUpload'
import { useManualBill } from '~/hooks/useManualBill'
import type { Id } from 'convex/_generated/dataModel'
import {
  getDeviceId,
  clearBillHistory,
  getBillHistory,
  rememberHostToken,
  type BillHistoryEntry,
} from '~/lib/session'
import { motion } from 'motion/react'
import { RiErrorWarningLine } from '@remixicon/react'
import { LegalFooter } from '~/components/shared/LegalFooter'
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert'
import { staggerChild, staggerContainer } from '~/lib/ui'
import { ScannerViewfinder } from './components/ScannerViewfinder'
import { ScanActions } from './components/ScanActions'
import { ResumeBillCard } from './components/ResumeBillCard'
import { RecentScanPanel } from './components/RecentScanPanel'
import { scanHubCopy, scanPrivacyNote } from './content'
import { trackFunnelMilestone } from '~/lib/observability'

export function ScannerHub() {
  const navigate = useNavigate()
  const scan = useScanUpload()
  const createDemoBill = useCreateDemoBill()
  const manual = useManualBill()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  // Photo picked but not yet confirmed — extraction is a paid call, so the
  // user gets one look ("readable? whole receipt in frame?") before we send it.
  const [pending, setPending] = useState<{ file: File; url: string } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<BillHistoryEntry[]>([])
  const busy = scan.busy || createDemoBill.isPending || manual.busy

  // Read local bill history on mount (client-only / localStorage).
  useEffect(() => {
    setHistory(getBillHistory())
  }, [])

  const lastBill = history[0] ?? null

  function startScan() {
    if (busy) return
    trackFunnelMilestone('scan_started')
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
      const { billId, hostToken } = await createDemoBill.mutateAsync({
        deviceId: getDeviceId(),
      })
      rememberHostToken(billId, hostToken)
      navigate({ to: '/review/$billId', params: { billId } })
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    }
  }

  // The no-camera fallback: a blank bill, straight into the review editor.
  // Never blocked by the extraction rate limits or the EXTRACTION_DISABLED kill
  // switch — this is the path those errors tell people to take.
  async function enterManually() {
    if (busy) return
    setError(null)
    try {
      await manual.startManualBill()
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    }
  }

  return (
    <div className="min-h-full bg-background px-4 pb-8 pt-4 text-foreground sm:px-6 md:px-10 md:pb-12">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={handleFile}
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-md flex-col gap-6 md:max-w-5xl"
      >
        {lastBill ? (
          <motion.div variants={staggerChild}>
            <ResumeBillCard entry={lastBill} onOpen={openBill} />
          </motion.div>
        ) : null}

        <main className="grid gap-6 md:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] md:items-start md:justify-center">
          <motion.section variants={staggerChild} className="space-y-5">
            <ScannerViewfinder busy={busy} previewUrl={pending?.url ?? null} />

            <ScanActions
              hasPending={pending !== null}
              busy={busy}
              onConfirm={() => void confirmPhoto()}
              onRetake={retake}
              onStartScan={startScan}
              onTrySample={() => void trySampleBill()}
              onEnterManually={() => void enterManually()}
            />

            <p className="text-center text-xs text-muted-foreground">
              {scanPrivacyNote}
            </p>

            {error ? (
              <Alert variant="destructive">
                <RiErrorWarningLine />
                <AlertTitle>{scanHubCopy.uploadError}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </motion.section>

          <motion.div variants={staggerChild}>
            <RecentScanPanel
              entries={history}
              onOpen={openBill}
              onClear={clearHistory}
            />
          </motion.div>
        </main>

        <LegalFooter />
      </motion.div>
    </div>
  )
}
