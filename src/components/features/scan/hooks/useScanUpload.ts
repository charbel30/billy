import { useState } from 'react'
import { ConvexError } from 'convex/values'
import type { Id } from 'convex/_generated/dataModel'
import {
  useAttachImageAndExtract,
  useCreateBill,
  useGenerateUploadUrl,
} from '~/api'
import { getDeviceId, getHostToken, rememberHostToken } from '~/lib/session'
import {
  captureFrontendError,
  markExtractionPending,
  trackExtractionOutcome,
  trackFunnelMilestone,
} from '~/lib/observability'

/** Friendly message for scan failures — surfaces ConvexError data (rate
 *  limits, kill switch) which is written to be shown to users as-is. */
export function scanErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data
  if (err instanceof Error && err.message) return err.message
  return fallback
}

// Shared scan pipeline: compress → upload to Convex storage → attach + schedule
// extraction. Used by the landing page (new bill) and the review screen's
// "scan again" path after a failed extraction (same bill).
export function useScanUpload() {
  const createBill = useCreateBill()
  const generateUploadUrl = useGenerateUploadUrl()
  const attach = useAttachImageAndExtract()
  const [busy, setBusy] = useState(false)

  async function uploadImage(file: File): Promise<Id<'_storage'>> {
    const { default: imageCompression } = await import('browser-image-compression')
    // Shrink before upload because image tokens dominate extraction cost.
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
    })
    const uploadUrl = await generateUploadUrl.mutateAsync({
      deviceId: getDeviceId(),
    })
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': compressed.type },
      body: compressed,
    })
    if (!res.ok) throw new Error('Upload failed')
    const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
    return storageId
  }

  async function scanNew(file: File): Promise<Id<'bills'>> {
    setBusy(true)
    let pendingBillId: Id<'bills'> | null = null
    try {
      const deviceId = getDeviceId()
      // createBill returns the host capability once and only once — persist it
      // before anything else can fail, or this bill becomes read-only forever.
      const { billId, hostToken } = await createBill.mutateAsync({ deviceId })
      pendingBillId = billId
      rememberHostToken(billId, hostToken)
      markExtractionPending(billId)
      const imageRef = await uploadImage(file)
      await attach.mutateAsync({ id: billId, imageRef, deviceId, hostToken })
      return billId
    } catch (error) {
      captureFrontendError(error)
      if (pendingBillId) trackExtractionOutcome(pendingBillId, 'failed')
      else trackFunnelMilestone('extraction_failed')
      throw error
    } finally {
      setBusy(false)
    }
  }

  async function rescan(billId: Id<'bills'>, file: File): Promise<void> {
    setBusy(true)
    markExtractionPending(billId)
    try {
      const imageRef = await uploadImage(file)
      await attach.mutateAsync({
        id: billId,
        imageRef,
        deviceId: getDeviceId(),
        hostToken: getHostToken(billId),
      })
    } catch (error) {
      captureFrontendError(error)
      trackExtractionOutcome(billId, 'failed')
      throw error
    } finally {
      setBusy(false)
    }
  }

  return { scanNew, rescan, busy }
}
