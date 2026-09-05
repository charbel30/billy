import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { RiArrowRightLine, RiCameraLine, RiLoader4Line } from '@remixicon/react'
import { useCreateDemoBill } from '~/api'
import { useManualBill } from '~/hooks/useManualBill'
import { getDeviceId, rememberHostToken } from '~/lib/session'
import { trackFunnelMilestone } from '~/lib/observability'
import { Button } from '~/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '~/components/ui/dialog'
import { heroCopy } from '~/components/features/landing/content'
import { scanErrorMessage, useScanUpload } from './hooks/useScanUpload'
import { scanHubCopy, scanPrivacyNote } from './content'

export function ScanReceiptActions() {
  const navigate = useNavigate()
  const scan = useScanUpload()
  const sample = useCreateDemoBill()
  const manual = useManualBill()
  const inputRef = useRef<HTMLInputElement>(null)
  const scanButtonRef = useRef<HTMLButtonElement>(null)
  const inFlight = useRef(false)
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = scan.busy || sample.isPending || manual.busy

  // Release previews on replacement, cancellation, successful upload, and unmount.
  useEffect(() => {
    return () => { if (pending) URL.revokeObjectURL(pending.url) }
  }, [pending])

  function startScan() {
    if (busy || inFlight.current) return
    setError(null)
    trackFunnelMilestone('scan_started')
    // Keep this synchronous with the tap so mobile browsers allow the picker.
    inputRef.current?.click()
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // Allow choosing the same photo again.
    if (!file || busy || inFlight.current) return
    setError(null)
    setPending({ file, url: URL.createObjectURL(file) })
  }

  async function confirmPhoto() {
    if (!pending || busy || inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      const billId = await scan.scanNew(pending.file)
      await navigate({ to: '/review/$billId', params: { billId } })
      setPending(null)
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    } finally {
      inFlight.current = false
    }
  }

  async function trySampleBill() {
    if (busy || inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      const { billId, hostToken } = await sample.mutateAsync({ deviceId: getDeviceId() })
      rememberHostToken(billId, hostToken)
      await navigate({ to: '/review/$billId', params: { billId } })
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    } finally {
      inFlight.current = false
    }
  }

  async function enterManually() {
    if (busy || inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      await manual.startManualBill()
    } catch (err) {
      setError(scanErrorMessage(err, scanHubCopy.fallbackError))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="landing-actions landing-enter">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Receipt photo"
        className="hidden"
        disabled={busy}
        onChange={handleFile}
      />
      <button ref={scanButtonRef} type="button" className="landing-scan" disabled={busy} onClick={startScan}>
        <RiCameraLine size={21} aria-hidden="true" />
        {heroCopy.primaryCta}
        <RiArrowRightLine size={20} aria-hidden="true" />
      </button>
      <p className="landing-reassurance">No account. No app to download.</p>
      <div className="landing-secondary-actions">
        <button type="button" className="landing-sample" disabled={busy} aria-busy={sample.isPending} onClick={() => void trySampleBill()}>
          {sample.isPending ? 'Opening sample…' : heroCopy.secondaryCta}
          {sample.isPending
            ? <RiLoader4Line size={16} className="animate-spin" aria-hidden="true" />
            : <RiArrowRightLine size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="landing-manual" disabled={busy} aria-busy={manual.busy} onClick={() => void enterManually()}>
          {manual.busy ? 'Opening bill…' : 'Enter manually'}
        </button>
      </div>
      <p className="landing-scan-privacy">{scanPrivacyNote}</p>
      {error && !pending && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

      <Dialog open={pending !== null} onOpenChange={(open) => {
        if (!open && !busy && !inFlight.current) {
          setPending(null)
          setError(null)
        }
      }}>
        <DialogContent
          finalFocus={scanButtonRef}
          showCloseButton={!busy}
          className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-3xl p-5 [&_[data-slot=dialog-close]]:size-10"
        >
          <DialogHeader className="pr-10">
            <DialogTitle>Looking good?</DialogTitle>
            <DialogDescription>Make sure the whole receipt is readable.</DialogDescription>
          </DialogHeader>
          {pending && (
            <img
              src={pending.url}
              alt="Receipt photo preview"
              className="h-[min(42dvh,22rem)] w-full rounded-xl bg-muted object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
            />
          )}
          <p className="text-xs text-muted-foreground">{scanPrivacyNote}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button className="h-12 active:scale-[0.96]" disabled={busy} aria-busy={scan.busy} onClick={() => void confirmPhoto()}>
              {scan.busy && <RiLoader4Line className="animate-spin" aria-hidden="true" />}
              {scan.busy ? 'Uploading receipt…' : 'Use this photo'}
            </Button>
            <Button variant="outline" className="h-12 px-5 active:scale-[0.96]" disabled={busy} onClick={startScan}>Retake</Button>
          </div>
          <button type="button" className="min-h-10 rounded-lg text-sm font-medium text-primary-strong disabled:opacity-50" disabled={busy} onClick={() => void enterManually()}>
            {manual.busy ? 'Opening bill…' : 'Enter a bill manually instead'}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
