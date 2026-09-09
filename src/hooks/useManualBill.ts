import { useNavigate } from '@tanstack/react-router'
import { useCreateBill } from '~/api'
import {
  assertHostStorageAvailable,
  getDeviceId,
  rememberHostToken,
} from '~/lib/session'

// "Enter it manually" — start a bill with no photo and land in the review
// editor with an empty item list.
//
// This deliberately reuses `createBill` (the same mutation the scan flow calls
// first): it only inserts a row and charges `createBillPerDevice`, so it does
// NOT touch `assertExtractionEnabled`, `uploadUrlPerDevice`, `extractPerDevice`,
// `extractGlobalDaily`, or the vision pipeline — all of which live in
// convex/bills/host/uploads.ts. That is the whole point: this path has to keep
// working exactly when scanning is exhausted, disabled, or failing.
export function useManualBill() {
  const navigate = useNavigate()
  const createBill = useCreateBill()

  async function startManualBill(): Promise<void> {
    assertHostStorageAvailable()
    const { billId, hostToken } = await createBill.mutateAsync({
      deviceId: getDeviceId(),
    })
    // The host capability is returned exactly once. Persist it before anything
    // else can fail, or the creator is locked out of its own bill.
    rememberHostToken(billId, hostToken)
    await navigate({ to: '/review/$billId', params: { billId } })
  }

  return { startManualBill, busy: createBill.isPending }
}
