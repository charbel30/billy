/** Open the share surface only once its link accepts guests. */
export async function openSplitInvite({ shared, publish, open }: {
  shared: boolean
  publish: () => Promise<unknown>
  open: () => void
}) {
  if (!shared) await publish()
  open()
}
