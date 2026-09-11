import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { FunctionArgs } from 'convex/server'

// Image upload + extraction (imperative; no optimistic update)

/**
 * The scan pipeline's Convex calls, as plain functions.
 *
 * Deliberately not `useMutation` wrappers: the pipeline is detached (the
 * landing page starts it and unmounts on the very next navigation, see
 * `src/hooks/useScanJob.ts`), so it must not depend on a React Query observer
 * staying mounted. These call the Convex client from context — that client
 * outlives the landing page; progress lives in the scan-job store instead.
 */
export function useScanFunctions() {
  const convex = useConvex()

  const createBill = useCallback(
    (args: FunctionArgs<typeof api.bills.host.lifecycle.createBill>) =>
      convex.mutation(api.bills.host.lifecycle.createBill, args),
    [convex],
  )
  const generateUploadUrl = useCallback(
    (args: FunctionArgs<typeof api.bills.host.uploads.generateUploadUrl>) =>
      convex.mutation(api.bills.host.uploads.generateUploadUrl, args),
    [convex],
  )
  const attachImageAndExtract = useCallback(
    (args: FunctionArgs<typeof api.bills.host.uploads.attachImageAndExtract>) =>
      convex.action(api.bills.host.uploads.attachImageAndExtract, args),
    [convex],
  )

  return { createBill, generateUploadUrl, attachImageAndExtract }
}

/** Give up on the in-flight extraction and keep the (empty) bill editable. */
export function useAbandonExtraction() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.host.uploads.abandonExtraction),
  })
}
