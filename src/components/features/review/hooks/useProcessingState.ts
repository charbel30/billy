import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { useScanJob } from '~/hooks/useScanJob'
import {
  clearScanJob,
  clearScanMarker,
  keepScanJob,
  releaseScanJobSoon,
  subscribeScanJobs,
  wasScanStarted,
} from '~/lib/session'
import type { ScanStage } from '~/lib/session'
import { PROCESSING_MIN_VISIBLE_MS, PROCESSING_SLOW_HINT_MS } from '~/lib/ui'
import type { BillStatus } from '~/lib/types'

export type ProcessingPhase = 'processing' | 'failed' | 'photo-lost' | 'editor'

/** Only what the machine reads off the live server document. */
export interface ProcessingBill {
  imageRef?: string | null
  extractionError?: string | null
  status: BillStatus
  lineItems: readonly unknown[]
}

export interface ProcessingState {
  phase: ProcessingPhase
  /** Which step of the pipeline to label; meaningless outside `processing`. */
  stage: ScanStage
  previewUrl: string | null
  /** The scan has run long enough to offer the manual-entry escape hatch. */
  slowHint: boolean
  errorMessage: string | null
  /** The editor is being revealed by a scan that just landed (drives motion). */
  revealed: boolean
  /** Give up on the failure surface and drop into the editor. */
  dismissFailure: () => void
}

/**
 * What the review route should show: the processing takeover, a failure
 * surface, or the editor (ux-flow-and-motion-plan.md §5, B.3).
 *
 * The editor is simply not rendered while a scan is in flight — that is what
 * closes the silent-discard bug, because `useBillEditor` can only bump the
 * bill's version if someone can type into it.
 */
export function useProcessingState(
  billId: Id<'bills'>,
  bill: ProcessingBill,
): ProcessingState {
  const job = useScanJob(billId)
  const scanStarted = useSyncExternalStore(
    subscribeScanJobs,
    () => wasScanStarted(billId),
    () => false,
  )
  const [dismissed, setDismissed] = useState(false)
  const extracting = Boolean(bill.imageRef)

  const uploading =
    job?.stage === 'creating' ||
    job?.stage === 'compressing' ||
    job?.stage === 'uploading' ||
    job?.stage === 'attaching'

  const target: ProcessingPhase = uploading
    ? 'processing'
    : extracting
      ? 'processing'
      : job?.stage === 'failed' || (bill.extractionError && !dismissed)
        ? 'failed'
        : scanStarted &&
            bill.lineItems.length === 0 &&
            !bill.extractionError &&
            bill.status === 'PENDING'
          ? 'photo-lost'
          : 'editor'

  const [phase, setPhase] = useState<ProcessingPhase>(target)
  const shownAt = useRef(target === 'processing' ? Date.now() : 0)
  const [slowHint, setSlowHint] = useState(false)
  const [revealed, setRevealed] = useState(false)

  // Hold the processing screen for a beat: a warm backend can answer before
  // the first frame is even readable, and a flash reads as a glitch.
  useEffect(() => {
    if (target === phase) return
    // `revealed` has to land in the SAME render as the editor, or the receipt
    // mounts unanimated and re-mounts a frame later to play the stagger.
    const commit = (next: ProcessingPhase) => {
      if (next === 'editor' && phase === 'processing') setRevealed(true)
      setPhase(next)
    }
    if (target === 'processing') {
      shownAt.current = Date.now()
      commit('processing')
      return
    }
    if (phase !== 'processing') {
      commit(target)
      return
    }
    const remaining = PROCESSING_MIN_VISIBLE_MS - (Date.now() - shownAt.current)
    if (remaining <= 0) {
      commit(target)
      return
    }
    const timer = setTimeout(() => commit(target), remaining)
    return () => clearTimeout(timer)
  }, [target, phase])

  useEffect(() => {
    if (phase !== 'processing') {
      setSlowHint(false)
      return
    }
    const elapsed = Date.now() - shownAt.current
    const timer = setTimeout(
      () => setSlowHint(true),
      Math.max(0, PROCESSING_SLOW_HINT_MS - elapsed),
    )
    return () => clearTimeout(timer)
  }, [phase])

  // Reaching the editor at all means the refresh marker has done its job.
  useEffect(() => {
    if (phase === 'editor') clearScanMarker(billId)
  }, [phase, billId])

  // A fresh attempt (scan again) re-arms the failure surface.
  useEffect(() => {
    if (job && job.stage !== 'failed') setDismissed(false)
  }, [job])

  // The preview belongs to this visit, but review remounts on the way in
  // (view transitions, ClientOnly, Suspense). Instant clear would abort the
  // in-flight upload. Hold it; a remount of the same bill cancels the release.
  useEffect(() => {
    keepScanJob(billId)
    return () => releaseScanJobSoon(billId)
  }, [billId])

  const dismissFailure = useCallback(() => {
    setDismissed(true)
    clearScanJob(billId)
    clearScanMarker(billId)
  }, [billId])

  return {
    phase,
    stage: job?.stage ?? (extracting ? 'extracting' : 'done'),
    previewUrl: job?.previewUrl ?? null,
    slowHint,
    errorMessage: job?.error ?? bill.extractionError ?? null,
    revealed,
    dismissFailure,
  }
}
