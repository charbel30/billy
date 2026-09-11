import type { BillHistoryEntry } from '~/lib/session'

export const scanHubCopy = {
  sampleAction: 'Try a sample bill',
  // The confirmation dialog. "Starting…" and not "Uploading…": the wait here
  // is only createBill — the upload itself happens on the review screen.
  confirmAction: 'Use this photo',
  startingAction: 'Starting…',
  // The no-camera escape hatch: always available, even when extraction is
  // rate-limited or paused (see src/hooks/useManualBill.ts).
  manualAction: 'Enter a bill manually',
  recentTitle: 'Continue',
  clearRecent: 'Clear',
  showLess: 'Show less',
  emptyRecent: 'No scans yet',
  emptyRecentHint: 'Your scanned receipts will appear here.',
  resumeFailed: 'That bill is no longer available.',
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

// Shown under the capture action. This is where the disclosure actually
// matters: the moment someone decides whether to photograph a receipt with
// their name on it. Quiet and factual — the details live on /privacy.
export const scanPrivacyNote =
  'Your photo is sent to Google AI to read the receipt, then deleted.'
