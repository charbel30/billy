import { useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

// Read option factories (live over WebSocket via the Convex adapter). The whole
// bill is one document, so a read is a single getBill / getBillByToken.
export const billQueries = {
  detail: (id: Id<'bills'>) => convexQuery(api.bills.queries.getBill, { id }),
  byToken: (shareToken: string) =>
    convexQuery(api.bills.queries.getBillByToken, { shareToken }),
}

// Editing is local-first (see src/lib/billEditor.ts): React state owns the bill
// while dirty and flushes the whole working document with a debounced
// `saveWorking`. There is no per-interaction CRUD and no optimistic-update layer —
// Convex pushes the flushed doc back to every subscriber.

export function useCreateBill() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.createBill),
  })
}

export function useSaveWorking() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.saveWorking),
  })
}

export function usePublish() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.publish),
  })
}

export function useFinalize() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.finalize),
  })
}

export function useAddHostPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.addHostPerson),
  })
}

export function useRemoveHostPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.removeHostPerson),
  })
}

export function useSaveHostClaims() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.saveHostClaims),
  })
}

export function useShareHostItemEvenly() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.shareHostItemEvenly),
  })
}

export function useJoinSplit() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.joinSplit),
  })
}

export function useAddGuestPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.addGuestPerson),
  })
}

export function useSaveGuestClaims() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.mutations.saveGuestClaims),
  })
}

// ---------------------------------------------------------------------------
// Image upload + extraction (imperative; no optimistic update)
// ---------------------------------------------------------------------------

export function useGenerateUploadUrl() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.uploads.generateUploadUrl),
  })
}

export function useAttachImageAndExtract() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.uploads.attachImageAndExtract),
  })
}
