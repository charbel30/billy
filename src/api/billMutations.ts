import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

// Editing is local-first (src/hooks/useBillEditor.ts): React state owns
// items/people/meta while dirty and flushes them with a debounced `saveWorking`.
// Claims are the exception — they're row-level and only written through the
// scoped claim mutations below. No optimistic-update layer anywhere: Convex
// pushes fresh results to every subscriber.

// --- Bill lifecycle (convex/bills/lifecycle.ts) ---

export function useCreateBill() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.createBill),
  })
}

export function useCreateDemoBill() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.createDemoBill),
  })
}

export function useSaveWorking() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.saveWorking),
  })
}

export function usePublish() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.publish),
  })
}

export function useFinalize() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.finalize),
  })
}

export function useRevokeShare() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.revokeShare),
  })
}

export function useSetTipPercent() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.lifecycle.setTipPercent),
  })
}

// --- People (convex/bills/people.ts) ---

export function useAddHostPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.people.addHostPerson),
  })
}

export function useRemoveHostPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.people.removeHostPerson),
  })
}

export function useSetHostPersonPaid() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.people.setHostPersonPaid),
  })
}

export function useSetGuestPersonPaid() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.people.setGuestPersonPaid),
  })
}

// --- Host claims (convex/bills/hostClaims.ts) ---

export function useSaveHostClaims() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.hostClaims.saveHostClaims),
  })
}

export function useShareHostItemEvenly() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.hostClaims.shareHostItemEvenly),
  })
}

export function useSplitLeftoversEvenly() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.hostClaims.splitLeftoversEvenly),
  })
}

// --- Guest writes (convex/bills/guest.ts) ---

export function useJoinSplit() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.joinSplit),
  })
}

export function useAddGuestPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.addGuestPerson),
  })
}

export function useSaveGuestClaims() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.saveGuestClaims),
  })
}
