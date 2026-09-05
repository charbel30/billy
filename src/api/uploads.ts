import { useMutation } from '@tanstack/react-query'
import { useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

// Image upload + extraction (imperative; no optimistic update)

export function useGenerateUploadUrl() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.uploads.generateUploadUrl),
  })
}

export function useAttachImageAndExtract() {
  return useMutation({
    mutationFn: useConvexAction(api.bills.host.uploads.attachImageAndExtract),
  })
}
