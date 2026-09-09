/** Track every write, including overlapping requests from different mutations. */
export class PendingWrites {
  private pending = new Set<Promise<boolean>>()

  track<T>(request: Promise<T>): Promise<T> {
    const settled = request.then(() => true, () => false)
    this.pending.add(settled)
    void settled.then(() => this.pending.delete(settled))
    return request
  }

  async wait(): Promise<boolean> {
    const results = await Promise.all([...this.pending])
    return results.every(Boolean)
  }
}
