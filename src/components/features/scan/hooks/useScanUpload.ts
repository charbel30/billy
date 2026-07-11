import { useState } from 'react'
import { ConvexError } from 'convex/values'
import imageCompression from 'browser-image-compression'
import type { Id } from 'convex/_generated/dataModel'
import {
  useAttachImageAndExtract,
  useCreateBill,
  useGenerateUploadUrl,
} from '~/api'
import { getDeviceId } from '~/lib/session'

/** Friendly message for scan failures — surfaces ConvexError data (rate
 *  limits, kill switch) which is written to be shown to users as-is. */
export function scanErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data
  if (err instanceof Error && err.message) return err.message
  return fallback
}

// Shared scan pipeline: compress → upload to Convex storage → attach + schedule
// extraction. Used by ScannerHub (new bill) and the review screen's
// "scan again" path after a failed extraction (same bill).
export function useScanUpload() {
  const createBill = useCreateBill()
  const generateUploadUrl = useGenerateUploadUrl()
  const attach = useAttachImageAndExtract()
  const [busy, setBusy] = useState(false)

  async function uploadImage(file: File): Promise<string> {
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
    const { storageId } = (await res.json()) as { storageId: string }
    return storageId
  }

  async function scanNew(file: File): Promise<Id<'bills'>> {
    setBusy(true)
    try {
      const deviceId = getDeviceId()
      const billId = await createBill.mutateAsync({ deviceId })
      const imageRef = await uploadImage(file)
      await attach.mutateAsync({ billId, imageRef, deviceId })
      return billId
    } finally {
      setBusy(false)
    }
  }

  async function rescan(billId: Id<'bills'>, file: File): Promise<void> {
    setBusy(true)
    try {
      const imageRef = await uploadImage(file)
      await attach.mutateAsync({ billId, imageRef, deviceId: getDeviceId() })
    } finally {
      setBusy(false)
    }
  }

  return { scanNew, rescan, busy }
}
