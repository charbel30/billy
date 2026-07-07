import type { BillHistoryEntry } from '~/lib/billHistory'

export const scanHubCopy = {
  readyStatus: 'Ready to scan',
  scanningStatus: 'Reading receipt',
  primaryAction: 'Start Scan',
  recentTitle: 'Recent bill scans',
  emptyRecent: 'No scans yet',
  emptyRecentHint: 'Your scanned receipts will appear here.',
  uploadError: 'Upload failed',
  fallbackError: 'Something went wrong',
}

export const STEP_LABEL: Record<BillHistoryEntry['step'], string> = {
  review: 'Reviewing',
  split: 'Splitting',
  summary: 'Summary',
}

// Recent-scans list shows this many entries before "Show all".
export const COLLAPSED_COUNT = 3
