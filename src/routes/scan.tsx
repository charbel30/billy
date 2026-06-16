import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import imageCompression from 'browser-image-compression'
import { RiCameraLine, RiLoader4Line } from '@remixicon/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  useAttachImageAndExtract,
  useCreateBill,
  useGenerateUploadUrl,
} from '~/queries'

export const Route = createFileRoute('/scan')({
  component: Scan,
})

function Scan() {
  const navigate = useNavigate()
  const createBill = useCreateBill()
  const generateUploadUrl = useGenerateUploadUrl()
  const attach = useAttachImageAndExtract()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      // Shrink before upload — image tokens dominate extraction cost (spec §4).
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 2000,
        useWebWorker: true,
      })
      const billId = await createBill.mutateAsync({})
      const uploadUrl = await generateUploadUrl.mutateAsync({})
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { storageId } = (await res.json()) as { storageId: string }
      await attach.mutateAsync({ billId, imageRef: storageId })
      // Extraction runs server-side; the review screen shows it filling in live.
      navigate({ to: '/review/$billId', params: { billId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Scan a receipt</CardTitle>
          <CardDescription>
            Point your camera at the bill. We compress it and read the items.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={busy}
              onChange={handleFile}
            />
            <span
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-all ${
                busy ? 'pointer-events-none opacity-60' : 'hover:bg-primary/80 cursor-pointer'
              }`}
            >
              {busy ? (
                <>
                  <RiLoader4Line className="animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <RiCameraLine /> Take / choose photo
                </>
              )}
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
