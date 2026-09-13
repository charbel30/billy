/** Add equal shares of `quantity` unclaimed orders; return an action to undo this split. */
export type ShareItemEvenly = (
  itemId: string,
  personIds: string[],
  quantity: number,
) => Promise<() => Promise<void>>
