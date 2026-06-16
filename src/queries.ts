import { useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

// Read option factories (live over WebSocket via the Convex adapter). The whole
// bill is one document, so a read is a single getBill / getBillByToken.
export const billQueries = {
  detail: (id: Id<'bills'>) => convexQuery(api.bills.getBill, { id }),
  byToken: (shareToken: string) =>
    convexQuery(api.bills.getBillByToken, { shareToken }),
}

// Editing is local-first (see src/lib/billEditor.ts): React state owns the bill
// while dirty and flushes the whole working document with a debounced
// `saveWorking`. There is no per-interaction CRUD and no optimistic-update layer —
// Convex pushes the flushed doc back to every subscriber.

export function useCreateBill() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.createBill) })
}

export function useSaveWorking() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.saveWorking) })
}

export function usePublish() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.publish) })
}

// ---------------------------------------------------------------------------
// Image upload + extraction (imperative; no optimistic update)
// ---------------------------------------------------------------------------

export function useGenerateUploadUrl() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.generateUploadUrl) })
}

export function useAttachImageAndExtract() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.attachImageAndExtract),
  })
}
