// Copy for the guest join screen (/join/$shareToken).
const hostName = 'Host'

export const joinCopy = {
  // What guests see instead of the host's internal person name ('self').
  // Also reserved as a guest name (RESERVED_GUEST_NAMES in src/lib/bill/constants.ts).
  hostName,
  // How the host's own person reads to guests (and in texts the host sends to
  // the table): hostDisplayName in src/lib/bill/hostPerson.ts.
  hostLabels: {
    seed: hostName,
    renamed: (name: string) => `${name} (host)`,
  },
}
