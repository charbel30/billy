export const summaryCopy = {
  headerDescription: {
    finalized: 'The final receipt — send everyone their share.',
    readOnly: 'A read-only view of this receipt.',
  },
  header: {
    allSettled: 'All settled',
    progress: (settled: number, total: number) =>
      `${settled} of ${total} settled`,
    outstanding: 'Outstanding',
  },
  progress: (settled: number, total: number) =>
    `${settled} of ${total} settled`,
  allSettled: 'All settled',
  outstanding: 'Outstanding',
  nothingClaimed: 'Nothing claimed',
  send: 'Send',
  sendAria: (name: string) => `Send ${name}'s total`,
  sendCopied: (name: string) => `Copied ${name}'s total`,
  shareAllTotals: 'Share all totals',
  shareTotals: 'Share totals as text',
  shareTotalsShort: 'Share all totals',
  showQr: 'Show QR',
  qrDialogTitle: 'Scan to see the receipt',
  qrCardTitle: 'Guests can scan to see the receipt',
  totalsCopied: 'Totals copied — paste them in the group chat',
  dock: {
    handle: 'Settlement',
    panelDescription: 'Rate and tip on this bill.',
    ariaLabel: 'Settlement details',
    rate: 'Venue rate',
    tip: (percent: number) => `${percent}% tip`,
    noTip: 'No tip added',
  },
  joinFinalized:
    'This split is finalized — the receipt is locked.',
}