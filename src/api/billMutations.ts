import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

// Editing is local-first (src/hooks/useBillEditor.ts): React state owns
// items/people/meta while dirty and flushes them with a debounced `saveWorking`.
// Claims are the exception — they're row-level and only written through the
// scoped claim mutations below. No optimistic-update layer anywhere: Convex
// pushes fresh results to every subscriber.

// --- Bill lifecycle (convex/bills/host/lifecycle.ts) ---

export function useCreateBill() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.createBill),
  })
}

export function useCreateDemoBill() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.createDemoBill),
  })
}

export function useSaveWorking() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.saveWorking),
  })
}

export function usePublish() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.publish),
  })
}

export function useFinalize() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.finalize),
  })
}

export function useRevokeShare() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.revokeShare),
  })
}

export function useSetTipPercent() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.lifecycle.setTipPercent),
  })
}

// --- People (convex/bills/host/people.ts + guest/people.ts) ---

export function useAddHostPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.people.addHostPerson),
  })
}

export function useRemoveHostPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.people.removeHostPerson),
  })
}

export function useSetHostPersonPaid() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.people.setHostPersonPaid),
  })
}

export function useSetGuestPersonPaid() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.people.setGuestPersonPaid),
  })
}

// --- Host claims (convex/bills/host/claims.ts) ---

export function useSaveHostClaims() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.claims.saveHostClaims),
  })
}

export function useShareHostItemEvenly() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.claims.shareHostItemEvenly),
  })
}

export function useSplitLeftoversEvenly() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.claims.splitLeftoversEvenly),
  })
}

// --- Guest writes (convex/bills/guest/people.ts + claims.ts) ---

export function useJoinSplit() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.people.joinSplit),
  })
}

export function useAddGuestPerson() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.people.addGuestPerson),
  })
}

export function useSaveGuestClaims() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.guest.claims.saveGuestClaims),
  })
}
