import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import imageCompression from 'browser-image-compression'
import { AnimatePresence, motion } from 'motion/react'
import {
  RiArrowRightLine,
  RiCameraLine,
  RiFileList3Line,
  RiLoader4Line,
  RiRestartLine,
} from '@remixicon/react'
import {
  useAttachImageAndExtract,
  useCreateBill,
  useGenerateUploadUrl,
} from '~/queries'
import type { Id } from 'convex/_generated/dataModel'
import {
  clearBillHistory,
  getBillHistory,
  type BillHistoryEntry,
} from '~/lib/billHistory'
import { cn } from '~/lib/utils'
import { scanHubCopy } from './scannerHubContent'
import '@fontsource-variable/figtree/wght.css'

export function ScannerHub() {
  const navigate = useNavigate()
  const createBill = useCreateBill()
  const generateUploadUrl = useGenerateUploadUrl()
  const attach = useAttachImageAndExtract()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<BillHistoryEntry[]>([])

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
        {lastBill ? (
          <button
            type="button"
            onClick={() => openBill(lastBill)}
            className="group flex items-center justify-between gap-3 rounded-3xl border border-border bg-card px-4 py-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.05)] transition-[transform,border-color] hover:border-foreground/20 active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <RiRestartLine className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  Resume {lastBill.name?.trim() || 'your bill'}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  Pick up where you left off · {lastBill.step}
                </span>
              </span>
            </span>
            <RiArrowRightLine className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : null}

        <main className="grid gap-6 md:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] md:items-start md:justify-center">
          <section className="space-y-5">
            <ScannerViewfinder busy={busy} />

            <button
              type="button"
              onClick={startScan}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-[0_16px_48px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={busy ? 'busy' : 'idle'}
                  className="grid place-items-center"
                  initial={{ scale: 0.25, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ scale: 0.25, opacity: 0, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                >
                  {busy ? (
                    <RiLoader4Line className="size-5 animate-spin" />
                  ) : (
                    <RiCameraLine className="size-5" />
                  )}
                </motion.span>
              </AnimatePresence>
              {busy ? scanHubCopy.scanningStatus : scanHubCopy.primaryAction}
            </button>

            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          </section>

          <RecentScanPanel
            entries={history}
            onOpen={openBill}
            onClear={clearHistory}
          />
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

const STEP_LABEL: Record<BillHistoryEntry['step'], string> = {
  review: 'Reviewing',
  split: 'Splitting',
  summary: 'Summary',
}

function timeAgo(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24
  if (d < 7) return `${Math.floor(d)}d ago`
  return new Date(at).toLocaleDateString()
}

const COLLAPSED_COUNT = 3

function RecentScanPanel({
  entries,
  onOpen,
  onClear,
}: {
  entries: BillHistoryEntry[]
  onOpen: (entry: BillHistoryEntry) => void
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = entries.length > COLLAPSED_COUNT
  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT)

  return (
    <section className="rounded-4xl bg-card/80 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.06)] ring-1 ring-border/50 backdrop-blur md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{scanHubCopy.recentTitle}</h2>
        <div className="flex items-center gap-2">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
            >
              Clear
            </button>
          ) : null}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
            {entries.length}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-pretty text-sm text-muted-foreground">
          {scanHubCopy.emptyRecent}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {visible.map((entry) => (
                <motion.button
                  key={entry.billId}
                  layout
                  type="button"
                  onClick={() => onOpen(entry)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <RiFileList3Line className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {entry.name?.trim() || 'Untitled bill'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {STEP_LABEL[entry.step]} · {timeAgo(entry.at)}
                    </span>
                  </span>
                  <RiArrowRightLine className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-full py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
            >
              {expanded ? 'Show less' : `Show all ${entries.length}`}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}
