import type { BillStatus } from '~/lib/types'

/** Human label for a bill's lifecycle status (workspace header badge). */
export function statusLabel(status: BillStatus): string {
  if (status === 'FINALIZED') return 'Finalized'
  if (status === 'PUBLISHED') return 'Shared'
  if (status === 'READY') return 'Draft'
  if (status === 'NEEDS_REVIEW') return 'Needs review'
  return 'Processing'
}
