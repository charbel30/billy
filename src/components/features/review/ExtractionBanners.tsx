import { useRef, useState } from 'react'
import { RiCameraLine, RiLoader4Line } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
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
    <div className="mb-5 rounded-3xl bg-destructive/10 p-4 text-sm ring-1 ring-destructive/20">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={scan.busy}
        onChange={(e) => void handleFile(e)}
      />
      <p className="font-bold text-destructive">
        We couldn&apos;t read this receipt.
      </p>
      <p className="mt-1 text-muted-foreground">
        Try a clearer photo — flatten the receipt and get the whole bill in
        frame — or add the items by hand below.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
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
      {error ? <p className="mt-2 text-destructive">{error}</p> : null}
    </div>
  )
}

export function ExtractingBanner() {
  return (
    <div className="mb-5 flex items-center justify-center gap-2 rounded-3xl border border-border bg-card/80 p-3 text-sm text-muted-foreground shadow-sm">
      <RiLoader4Line className="animate-spin" /> Reading your receipt...
    </div>
  )
}
