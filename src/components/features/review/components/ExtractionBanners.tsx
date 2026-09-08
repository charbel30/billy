import { useRef, useState } from 'react'
import { RiCameraLine, RiErrorWarningLine, RiLoader4Line } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { ReceiptScan } from '~/components/shared/ReceiptScan'
import {
  scanErrorMessage,
  useScanUpload,
} from '~/components/features/scan/hooks/useScanUpload'

// Extraction failed (vision call threw / returned garbage). Never a dead end:
// re-scan into the SAME bill, or dismiss and type the items in by hand.
export function ExtractionFailedBanner({
  billId,
  onDismiss,
}: {
  billId: Id<'bills'>
  onDismiss: () => void
}) {
  const scan = useScanUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      await scan.rescan(billId, file)
    } catch (err) {
      setError(scanErrorMessage(err, 'Something went wrong'))
    }
  }

  return (
    <Alert variant="destructive" className="mb-5">
      <RiErrorWarningLine />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={scan.busy}
        onChange={(e) => void handleFile(e)}
      />
      <AlertTitle>We couldn&apos;t read this receipt.</AlertTitle>
      <AlertDescription>
        Try a clearer photo — flatten the receipt and get the whole bill in
        frame — or add the items by hand below.
      </AlertDescription>
      <div className="col-start-2 mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={scan.busy}
        >
          {scan.busy ? (
            <RiLoader4Line className="animate-spin" />
          ) : (
            <RiCameraLine />
          )}
          {scan.busy ? 'Reading receipt...' : 'Scan again'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss}>
          Enter items manually
        </Button>
      </div>
      {error ? <p className="col-start-2 mt-2 font-semibold">{error}</p> : null}
    </Alert>
  )
}

export function ExtractingBanner() {
  return (
    <div role="status" aria-live="polite" className="mb-5 flex items-center gap-4 rounded-card bg-primary/10 p-4 sm:p-5">
      <ReceiptScan />
      <div>
        <p className="text-base font-bold tracking-tight">Reading your receipt</p>
        <p className="mt-1 text-sm text-muted-foreground">Finding the items and totals in LBP and USD.</p>
      </div>
    </div>
  )
}
