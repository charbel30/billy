// The scan disclosure has one owner (it is shown first at capture time); the
// processing screen repeats it verbatim rather than inventing a variant.
import { scanPrivacyNote } from '~/components/features/scan/content'

export const reviewCopy = {
  subhead: 'Review the scanned items before splitting.',
  // A manually-started bill (src/hooks/useManualBill.ts) and a bill whose
  // extraction failed both land here with nothing to review — say what to do
  // instead of asking them to review an empty list.
  emptySubhead: 'Add the items from your bill, then split it.',
  emptyTitle: 'No items yet',
  emptyHint:
    'Add each line from your bill — name it, set the quantity, then type the amount in LBP.',
  addFirstAction: 'Add the first item',
  caption: 'Receipt audit',
  emptyCaption: 'Bill items',
  addAction: 'Add item',
  readOnlySubhead: 'This bill does not have any items to show.',
  recoveryUnavailable:
    'This browser cannot keep a recovery copy. Keep this page open until changes finish saving.',
  editedElsewhereTitle:
    'This bill changed in another tab or while scanning. Your draft has been kept.',
  editedElsewhereBody:
    'Review the latest version, or explicitly save your draft over it.',
  useServerVersion: 'Use latest version',
  keepLocalVersion: 'Save my draft instead',
  // The settlement dock: collapsed total + the panel behind the handle.
  dock: {
    handle: 'Settlement',
    matches: 'Matches receipt',
    checkTotals: 'Check totals',
    totalLabel: 'Total',
    proceed: 'Proceed to split',
    ariaLabel: 'Open settlement details: service, tax and exchange rate',
    panelDescription: 'Service, tax and the exchange rate for this bill.',
    mismatchTitle: "Totals don't add up",
    mismatchBody: 'Items differ from the printed receipt total by',
    mismatchHint: '. Check the lines on the receipt.',
  },
  // The full-screen scan wait and the two ways it can end badly.
  processing: {
    stages: {
      uploading: 'Uploading your photo',
      reading: 'Reading the receipt',
      checking: 'Checking totals',
    },
    photoAlt: 'The receipt being scanned',
    privacyNote: scanPrivacyNote,
    slowAction: 'Taking long? Enter items manually',
    failedTitle: "We couldn't read this receipt.",
    failedBody:
      'Try a clearer photo — flatten the receipt and get the whole bill in frame — or add the items by hand.',
    photoLostTitle: "The photo didn't finish uploading.",
    photoLostBody: 'Scan it again or add the items by hand.',
    scanAgain: 'Scan again',
    enterManually: 'Enter items manually',
    working: 'Working…',
  },
  // The session-only "compare with photo" thumbnail in the header.
  photoThumb: {
    label: 'Compare with photo',
    title: 'Your receipt photo',
    disclosure:
      'Kept on this device only for this session — it is not stored.',
  },
}
