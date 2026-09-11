export const splitCopy = {
  description: {
    host: 'Pick a person, claim their items, and invite everyone from this same screen.',
    finalized: 'A read-only view of the finalized receipt.',
    readOnly: 'A read-only view of the live split.',
  },
  summaryDescription: {
    finalized: 'This split is finalized and read-only.',
    host: 'Updates live as people claim items.',
    readOnly: 'View only. The split can still change on the host device.',
  },
  finalizedLock: 'This split is finalized, so edits are locked for everyone.',
  invite: {
    title: 'Invite people to join',
    hint: 'Share a link or QR code so everyone can pick their items.',
    dialogTitle: 'Scan to join the split',
  },
  actions: {
    viewSummary: 'View final summary',
    finalize: 'Finalize',
  },
  conflicts: {
    partialClaim:
      'Some units were already claimed, so we kept only what was still available.',
    claimFailed: 'That claim could not be saved. Please try again.',
    shareFailed: 'That split could not be saved. Please try again.',
    unsavedEdit: 'An edit could not be saved. Check the split before finalizing.',
  },
  finalizeDialog: {
    title: 'Finalize this split?',
    body: 'This locks edits for everyone and turns the summary into a read-only receipt.',
    confirm: 'Finalize split',
    cancel: 'Cancel',
    leftoverTitle: 'Some items are still unclaimed',
    leftoverBodyEnd: 'has no owner yet. Split it evenly, or finalize with it left off everyone’s totals.',
    splitLeftovers: 'Split leftovers evenly',
    finalizeAsIs: 'Finalize as is',
    keepSplitting: 'Keep splitting',
  },
}

/** "across 3 items" / "across 1 item" — the middle of the leftover warning. */
export function leftoverItemsPhrase(count: number): string {
  return `across ${count} ${count === 1 ? 'item' : 'items'}`
}

/** The extra sentence shown when service and tax cannot be allocated yet. */
export function unallocatedServiceNote(amount: string): string {
  return ` Another ${amount} of service and tax stays unallocated until priced items are claimed or service is split evenly.`
}
