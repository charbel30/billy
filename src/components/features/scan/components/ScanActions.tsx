import { AnimatePresence, motion } from 'motion/react'
import {
  RiCameraLine,
  RiCheckLine,
  RiLoader4Line,
  RiRestartLine,
} from '@remixicon/react'
import { swap, tapHaptic } from '~/lib/ui'
import { scanHubCopy } from '../content'

// The buttons under the viewfinder. With a pending photo: confirm ("Use this
// photo") + retake. Otherwise: the big Start Scan CTA + the two zero-camera
// escape hatches — the sample bill (a pre-filled demo) and manual entry (an
// empty bill you type yourself, the fallback when scanning is unavailable).
export function ScanActions({
  hasPending,
  busy,
  onConfirm,
  onRetake,
  onStartScan,
  onTrySample,
  onEnterManually,
}: {
  hasPending: boolean
  busy: boolean
  onConfirm: () => void
  onRetake: () => void
  onStartScan: () => void
  onTrySample: () => void
  onEnterManually: () => void
}) {
  if (hasPending) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <button
          type="button"
          onClick={() => {
            tapHaptic()
            onConfirm()
          }}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-raised transition-[scale,opacity] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
        >
          {busy ? (
            <RiLoader4Line className="size-5 animate-spin" />
          ) : (
            <RiCheckLine className="size-5" />
          )}
          {busy ? scanHubCopy.scanningStatus : 'Use this photo'}
        </button>
        <button
          type="button"
          onClick={onRetake}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-muted px-5 py-4 text-base font-bold text-foreground transition-[scale,opacity] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
        >
          <RiRestartLine className="size-5" />
          Retake
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tapHaptic()
          onStartScan()
        }}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-raised transition-[scale,opacity] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={busy ? 'busy' : 'idle'}
            className="grid place-items-center"
            {...swap}
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
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          onClick={onTrySample}
          disabled={busy}
          className={SECONDARY_ACTION}
        >
          {scanHubCopy.sampleAction}
        </button>
        <span aria-hidden className="text-muted-foreground/40">
          &middot;
        </span>
        <button
          type="button"
          onClick={() => {
            tapHaptic()
            onEnterManually()
          }}
          disabled={busy}
          className={SECONDARY_ACTION}
        >
          {scanHubCopy.manualAction}
        </button>
      </div>
    </>
  )
}

const SECONDARY_ACTION =
  'rounded-full px-4 py-1.5 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-70'
