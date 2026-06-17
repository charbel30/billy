import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import imageCompression from 'browser-image-compression'
import { motion } from 'motion/react'
import {
  RiCameraLine,
  RiFileList3Line,
  RiLoader4Line,
} from '@remixicon/react'
import {
  useAttachImageAndExtract,
  useCreateBill,
  useGenerateUploadUrl,
} from '~/queries'
import { cn } from '~/lib/utils'
import { recentScanPlaceholders, scanHubCopy } from './scannerHubContent'
import '@fontsource-variable/figtree/wght.css'

export function ScannerHub() {
  const navigate = useNavigate()
  const createBill = useCreateBill()
  const generateUploadUrl = useGenerateUploadUrl()
  const attach = useAttachImageAndExtract()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startScan() {
    if (busy) return
    cameraInputRef.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      // Shrink before upload because image tokens dominate extraction cost.
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
      if (!res.ok) throw new Error(scanHubCopy.uploadError)
      const { storageId } = (await res.json()) as { storageId: string }
      await attach.mutateAsync({ billId, imageRef: storageId })
      navigate({ to: '/review/$billId', params: { billId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : scanHubCopy.fallbackError)
      setBusy(false)
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
        <main className="grid gap-6 md:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] md:items-start md:justify-center">
          <section className="space-y-5">
            <ScannerViewfinder busy={busy} />

            <button
              type="button"
              onClick={startScan}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-[0_16px_48px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
            >
              {busy ? (
                <RiLoader4Line className="size-5 animate-spin" />
              ) : (
                <RiCameraLine className="size-5" />
              )}
              {busy ? scanHubCopy.scanningStatus : scanHubCopy.primaryAction}
            </button>

            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          </section>

          <RecentScanPanel />
        </main>
      </div>
    </div>
  )
}

function ScannerViewfinder({ busy }: { busy: boolean }) {
  return (
    <section className="relative aspect-[3/4] overflow-hidden rounded-4xl border border-border/70 bg-muted">
      <ScannerCorners />

      <motion.div
        className="absolute left-0 z-10 h-0.5 w-full bg-primary shadow-[0_0_16px_rgba(0,0,0,0.35)]"
        initial={{ top: '0%', opacity: 0 }}
        animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
        transition={{
          duration: busy ? 1.4 : 2.5,
          repeat: Infinity,
          ease: [0.4, 0, 0.2, 1],
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-1/2 w-2/3 flex-col gap-3 opacity-60">
          {[72, 48, 100, 84, 64].map((width, index) => (
            <div
              key={width}
              className={cn(
                'relative h-3 overflow-hidden rounded-full bg-border',
                index === 2 ? 'mt-6' : '',
              )}
              style={{ width: `${width}%` }}
            >
              <motion.div
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-background/60 to-transparent"
                initial={{ x: '-120%' }}
                animate={{ x: '240%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: index * 0.12,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
          <RiCameraLine className={cn('size-4', busy ? 'animate-pulse text-primary' : '')} />
          {busy ? scanHubCopy.scanningStatus : scanHubCopy.readyStatus}
        </div>
      </div>
    </section>
  )
}

function ScannerCorners() {
  const cornerClass = 'absolute size-8 border-primary'
  return (
    <>
      <div className={cn(cornerClass, 'left-6 top-6 rounded-tl-xl border-l-4 border-t-4')} />
      <div className={cn(cornerClass, 'right-6 top-6 rounded-tr-xl border-r-4 border-t-4')} />
      <div className={cn(cornerClass, 'bottom-6 left-6 rounded-bl-xl border-b-4 border-l-4')} />
      <div className={cn(cornerClass, 'bottom-6 right-6 rounded-br-xl border-b-4 border-r-4')} />
    </>
  )
}

function RecentScanPanel() {
  return (
    <section className="rounded-4xl bg-card/80 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.06)] ring-1 ring-border/50 backdrop-blur md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{scanHubCopy.recentTitle}</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          {recentScanPlaceholders.length}
        </span>
      </div>

      <div className="space-y-2">
        {recentScanPlaceholders.map((scan) => (
          <div
            key={scan.name}
            className="flex items-center gap-3 rounded-3xl bg-muted/70 px-4 py-3"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <RiFileList3Line className="size-5" />
            </span>
            <span className="font-semibold">{scan.name}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{scanHubCopy.emptyRecent}</p>
    </section>
  )
}
