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
}
