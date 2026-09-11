import { useCallback, useSyncExternalStore } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { useScanFunctions } from '~/api'
import { scanErrorMessage } from '~/lib/bill'
import {
  assertHostStorageAvailable,
  clearScanJob,
  getDeviceId,
  getHostToken,
  getScanJob,
  markScanStarted,
  rememberHostToken,
  setScanJob,
  subscribeScanJobs,
} from '~/lib/session'
import type { ScanJob, ScanStage } from '~/lib/session'
import {
  captureFrontendError,
  markExtractionPending,
  trackExtractionOutcome,
  trackFunnelMilestone,
} from '~/lib/observability'
import { scanHubCopy } from '~/components/features/scan/content'

// The scan pipeline, hoisted out of the landing page (ux-flow-and-motion-plan
// §5). `startScan` resolves as soon as the bill exists so the caller can
// navigate; compression, upload and extraction scheduling continue detached
// and report progress through the scan-job store, which the review screen
// subscribes to. Nothing here keeps component state — the caller can unmount
// mid-flight and the wait survives.

/** Live view of a bill's scan job, or `undefined` when it has none. */
export function useScanJob(billId: string): ScanJob | undefined {
  return useSyncExternalStore(
    subscribeScanJobs,
    () => getScanJob(billId),
    () => undefined,
  )
}

/** Move a live job along; a job that has been cleared is never resurrected. */
function advance(billId: string, stage: ScanStage): void {
  const job = getScanJob(billId)
  if (!job) return
  setScanJob({ ...job, stage })
}

function failScan(billId: string, error: string): void {
  const job = getScanJob(billId)
  if (!job) return
  setScanJob({ ...job, stage: 'failed', error })
}

async function compressReceipt(file: File): Promise<File> {
  const { default: imageCompression } = await import('browser-image-compression')
  // Shrink before upload because image tokens dominate extraction cost.
  return await imageCompression(file, {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
  })
}

async function putImage(
  uploadUrl: string,
  image: File,
): Promise<Id<'_storage'>> {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': image.type },
    body: image,
  })
  if (!res.ok) throw new Error(scanHubCopy.uploadError)
  const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
  return storageId
}

export function useScanRunner() {
  const { createBill, generateUploadUrl, attachImageAndExtract } =
    useScanFunctions()

  const runPipeline = useCallback(
    async (billId: Id<'bills'>, file: File, hostToken: string) => {
      const deviceId = getDeviceId()
      const startedAt = getScanJob(billId)?.startedAt
      const stillThisJob = () => getScanJob(billId)?.startedAt === startedAt
      try {
        advance(billId, 'compressing')
        const compressed = await compressReceipt(file)
        if (!stillThisJob()) return
        advance(billId, 'uploading')
        const uploadUrl = await generateUploadUrl({ deviceId })
        const imageRef = await putImage(uploadUrl, compressed)
        // The screen moved on (abandoned, or the bill was left) while the
        // bytes were in the air: do not start an extraction behind the user's
        // back. The upload is unreferenced and the retention sweep takes it.
        if (!stillThisJob()) return
        advance(billId, 'attaching')
        await attachImageAndExtract({
          id: billId,
          imageRef,
          deviceId,
          hostToken,
        })
        if (!stillThisJob()) return
        // `extracting → done` is the server's call: the review screen watches
        // the bill's imageRef clear.
        advance(billId, 'extracting')
      } catch (error) {
        if (!stillThisJob()) return
        captureFrontendError(error)
        trackExtractionOutcome(billId, 'failed')
        failScan(billId, scanErrorMessage(error, scanHubCopy.fallbackError))
      }
    },
    [generateUploadUrl, attachImageAndExtract],
  )

  /** Create the bill, start the scan, and hand the id back for navigation. */
  const startScan = useCallback(
    async (file: File): Promise<Id<'bills'>> => {
      try {
        assertHostStorageAvailable()
        // createBill returns the host capability once and only once — persist
        // it before anything else can fail, or this bill is read-only forever.
        const { billId, hostToken } = await createBill({
          deviceId: getDeviceId(),
        })
        rememberHostToken(billId, hostToken)
        markScanStarted(billId)
        markExtractionPending(billId)
        setScanJob({
          billId,
          stage: 'creating',
          previewUrl: URL.createObjectURL(file),
          startedAt: Date.now(),
        })
        void runPipeline(billId, file, hostToken)
        return billId
      } catch (error) {
        // Nothing to show a job for yet — the caller owns this message.
        captureFrontendError(error)
        trackFunnelMilestone('extraction_failed')
        throw error
      }
    },
    [createBill, runPipeline],
  )

  /** Scan a new photo into an existing bill (the "scan again" path). */
  const rescan = useCallback(
    (billId: Id<'bills'>, file: File): void => {
      clearScanJob(billId) // release the failed attempt's preview
      markScanStarted(billId)
      markExtractionPending(billId)
      setScanJob({
        billId,
        stage: 'compressing',
        previewUrl: URL.createObjectURL(file),
        startedAt: Date.now(),
      })
      void runPipeline(billId, file, getHostToken(billId))
    },
    [runPipeline],
  )

  return { startScan, rescan }
}
