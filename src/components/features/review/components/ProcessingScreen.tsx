import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiLoader4Line } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { ReceiptScan } from '~/components/shared/ReceiptScan'
import { fadeRise, PROCESSING_CHECKING_LABEL_MS } from '~/lib/ui'
import type { ScanStage } from '~/lib/session'
import { cn } from '~/lib/utils'
import { reviewCopy } from '../content'

const STAGE_COUNT = 3

/**
 * The scan wait, full screen: the user's own photo being read, one honest
 * stage label, and — only once it has taken long enough to worry about — the
 * way out. The editor is deliberately absent (see `useProcessingState`).
 */
export function ProcessingScreen({
  previewUrl,
  stage,
  slowHint,
  onEnterManually,
  busy = false,
}: {
  previewUrl: string | null
  stage: ScanStage
  slowHint: boolean
  onEnterManually: () => void
  busy?: boolean
}) {
  const copy = reviewCopy.processing
  // Cosmetic only: extraction reports no progress, so the label moves on after
  // long enough to make "reading" feel stuck.
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    if (stage !== 'extracting') {
      setChecking(false)
      return
    }
    const timer = setTimeout(() => setChecking(true), PROCESSING_CHECKING_LABEL_MS)
    return () => clearTimeout(timer)
  }, [stage])

  const step =
    stage === 'extracting' ? (checking ? 2 : 1) : stage === 'done' ? 2 : 0
  const label = [copy.stages.uploading, copy.stages.reading, copy.stages.checking][
    step
  ]

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 pb-10 pt-2 text-center sm:px-6">
      <ScanPhoto previewUrl={previewUrl} beam dim="opacity-70" />

      <div>
        <p
          role="status"
          aria-live="polite"
          className="text-lg font-black tracking-tight"
        >
          {label}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.privacyNote}</p>
      </div>

      <div aria-hidden className="flex items-center gap-2">
        {Array.from({ length: STAGE_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              'size-2 rounded-full transition-colors duration-300',
              index <= step ? 'bg-primary-strong' : 'bg-primary/25',
            )}
          />
        ))}
      </div>

      <AnimatePresence>
        {slowHint ? (
          <motion.div key="escape" {...fadeRise} exit={{ opacity: 0 }}>
            <Button
              variant="outline"
              className="min-h-12"
              disabled={busy}
              onClick={onEnterManually}
            >
              {busy ? (
                <RiLoader4Line className="animate-spin" aria-hidden />
              ) : null}
              {busy ? copy.working : copy.slowAction}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * The receipt being worked on — the shared element between the confirmation
 * dialog, this screen and the header thumbnail. Falls back to the illustration
 * when there is no local photo (a direct load, or a reload mid-extraction).
 */
export function ScanPhoto({
  previewUrl,
  beam = false,
  dim,
}: {
  previewUrl: string | null
  beam?: boolean
  dim?: string
}) {
  if (!previewUrl) {
    return (
      <div className="grid h-[min(42dvh,22rem)] w-full place-items-center rounded-card bg-muted">
        <ReceiptScan className="size-24" />
      </div>
    )
  }
  return (
    <div className="relative w-full overflow-hidden rounded-card bg-muted">
      <motion.img
        layoutId="receipt-photo"
        src={previewUrl}
        alt={reviewCopy.processing.photoAlt}
        style={{ viewTransitionName: 'receipt-photo' }}
        className={cn(
          'mx-auto block max-h-[min(58dvh,34rem)] w-full object-contain',
          dim,
        )}
      />
      {beam ? (
        <span
          aria-hidden
          className="scan-beam pointer-events-none absolute inset-x-0 top-0 h-[20%] bg-linear-to-b from-transparent via-primary/45 to-transparent"
        />
      ) : null}
    </div>
  )
}
