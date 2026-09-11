// The in-flight receipt scan for a bill, kept OUTSIDE React because the scan
// outlives the component that starts it: the landing page creates the bill,
// navigates to /review/$billId and unmounts while the photo is still being
// compressed and uploaded. The review screen subscribes to the same job and
// owns the wait from there (ux-flow-and-motion-plan.md §5).
//
// The chosen photo's object URL lives here too — it is the only copy of the
// receipt image the user ever sees again (the server deletes it right after
// extraction), so it powers both the processing screen and the session-only
// "compare with photo" thumbnail. Revoked by clearScanJob, never persisted.

export type ScanStage =
  | 'creating'
  | 'compressing'
  | 'uploading'
  | 'attaching'
  | 'extracting'
  | 'done'
  | 'failed'

export interface ScanJob {
  billId: string
  stage: ScanStage
  /** Object URL of the chosen file; revoked by `clearScanJob`. */
  previewUrl: string | null
  startedAt: number
  /** `scanErrorMessage()` result when `stage === 'failed'`. */
  error?: string
}

const jobs = new Map<string, ScanJob>()
const listeners = new Set<() => void>()
const pendingRelease = new Map<string, ReturnType<typeof setTimeout>>()

// Review remounts on the way in (view transitions, ClientOnly, Suspense).
// Clearing the job in that cleanup aborts the pipeline the landing page just
// started — the user then sees "the photo didn't finish uploading" and has to
// submit twice. Hold the job briefly; a remount of the same bill cancels.
const RELEASE_GRACE_MS = 2_500

// sessionStorage rather than localStorage: "a scan was started for this bill"
// is only true for this tab, and a reload has to be able to tell a bill whose
// upload died mid-flight apart from a manually created one. Same `billy:`
// prefix as hostToken.ts / billHistory.ts.
const MARKER_PREFIX = 'billy:scan-job:'

function emit(): void {
  for (const listener of listeners) listener()
}

/** Subscribe to every job change (useSyncExternalStore-compatible). */
export function subscribeScanJobs(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getScanJob(billId: string): ScanJob | undefined {
  return jobs.get(billId)
}

export function setScanJob(job: ScanJob): void {
  keepScanJob(job.billId)
  jobs.set(job.billId, job)
  emit()
}

/** Cancel a pending unmount-release so a remount of the same bill keeps the job. */
export function keepScanJob(billId: string): void {
  const timer = pendingRelease.get(billId)
  if (!timer) return
  clearTimeout(timer)
  pendingRelease.delete(billId)
}

/** Drop the job after a beat. Cancelled if the same bill's review remounts. */
export function releaseScanJobSoon(billId: string): void {
  keepScanJob(billId)
  pendingRelease.set(
    billId,
    setTimeout(() => {
      pendingRelease.delete(billId)
      clearScanJob(billId)
    }, RELEASE_GRACE_MS),
  )
}

/** Drop the job and release its object URL. */
export function clearScanJob(billId: string): void {
  keepScanJob(billId)
  const job = jobs.get(billId)
  if (!job) return
  if (job.previewUrl) URL.revokeObjectURL(job.previewUrl)
  jobs.delete(billId)
  emit()
}

/** Record that this tab started a scan for the bill (survives a reload). */
export function markScanStarted(billId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(`${MARKER_PREFIX}${billId}`, String(Date.now()))
  } catch {
    // Private mode / blocked storage: the marker is a nicety, not a gate.
  }
  emit()
}

export function wasScanStarted(billId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(`${MARKER_PREFIX}${billId}`) !== null
  } catch {
    return false
  }
}

export function clearScanMarker(billId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(`${MARKER_PREFIX}${billId}`)
  } catch {
    // ignore
  }
  emit()
}
