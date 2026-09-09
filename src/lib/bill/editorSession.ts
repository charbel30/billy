import type { WorkingBill, SaveState } from './types'
import { canPersistWorkingBill, sanitizeWorkingBill } from './working'

export type { SaveState } from './types'
type EditorIO = {
  save: (
    draft: WorkingBill,
    baseVersion: number,
  ) => Promise<{ version: number }>
  persist: (draft: WorkingBill) => boolean
  clear: (acknowledged: WorkingBill) => void
}

/** Coordinates local drafts with server acknowledgements, independently of renders. */
export class EditorSession {
  working: WorkingBill
  state: SaveState = 'saved'
  editedElsewhere = false
  recoveryUnavailable = false
  private latestServer: WorkingBill
  private version: number
  private revision = 0
  private acknowledgedRevision = 0
  private inFlight: Promise<boolean> | null = null
  private listeners = new Set<() => void>()

  constructor(
    initial: WorkingBill,
    private io: EditorIO,
  ) {
    this.working = initial
    this.latestServer = initial
    this.version = initial.version
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private notify() {
    for (const listener of this.listeners) listener()
  }
  private get dirty() {
    return this.revision !== this.acknowledgedRevision
  }
  private persist() {
    this.recoveryUnavailable = !this.io.persist(this.working)
  }

  edit(next: WorkingBill) {
    if (this.latestServer.status === 'FINALIZED') return
    this.working = { ...next, version: this.version }
    this.revision++
    this.state = 'unsaved'
    this.persist()
    this.notify()
  }

  restore(local: WorkingBill) {
    if (this.latestServer.status === 'FINALIZED') return
    this.working = local
    this.revision++
    this.version = local.version
    this.state = 'unsaved'
    this.editedElsewhere = local.version !== this.latestServer.version
    this.notify()
  }

  receive(server: WorkingBill) {
    if (server.version < this.version) return
    this.latestServer = server
    // The push for our own mutation can arrive before its promise resolves.
    if (this.inFlight) return
    if (this.dirty) {
      this.editedElsewhere =
        server.version !== this.version || server.status === 'FINALIZED'
    } else {
      this.working = server
      this.version = server.version
      this.editedElsewhere = false
    }
    this.notify()
  }

  useServer() {
    if (this.inFlight) return
    this.io.clear(this.working)
    this.working = this.latestServer
    this.version = this.latestServer.version
    this.acknowledgedRevision = this.revision
    this.editedElsewhere = false
    this.state = 'saved'
    this.notify()
  }

  keepLocal() {
    if (this.inFlight || this.latestServer.status === 'FINALIZED') return
    this.version = this.latestServer.version
    this.working = { ...this.working, version: this.version }
    this.editedElsewhere = false
    this.state = 'unsaved'
    this.persist()
    this.notify()
  }

  flush(): Promise<boolean> {
    if (this.inFlight) return this.inFlight
    if (
      this.editedElsewhere ||
      (this.dirty && this.latestServer.status === 'FINALIZED')
    )
      return Promise.resolve(false)
    if (!this.dirty) return Promise.resolve(canPersistWorkingBill(this.working))
    // Schedule the loop after assigning inFlight, even if the adapter rejects immediately.
    this.inFlight = Promise.resolve()
      .then(() => this.saveDrafts())
      .finally(() => {
        this.inFlight = null
        if (!this.dirty && this.latestServer.version >= this.version) {
          this.working = this.latestServer
          this.version = this.latestServer.version
        }
        if (
          this.latestServer.version > this.version ||
          (this.latestServer.status === 'FINALIZED' && this.dirty)
        ) {
          this.editedElsewhere = true
        }
        this.notify()
      })
    return this.inFlight
  }

  private async saveDrafts(): Promise<boolean> {
    while (this.dirty) {
      const draft = this.working
      const clean = sanitizeWorkingBill(draft)
      const revision = this.revision
      if (!canPersistWorkingBill(clean)) {
        this.state = 'failed'
        this.notify()
        return false
      }
      this.state = 'saving'
      this.notify()
      try {
        const result = await this.io.save(clean, this.version)
        this.version = result.version
        this.acknowledgedRevision = revision
        // Never clear a recovery copy created after this request began.
        this.io.clear(draft)
        this.working = { ...this.working, version: result.version }
        if (this.dirty) this.persist()
        this.state = this.dirty ? 'unsaved' : 'saved'
        this.notify()
      } catch {
        this.state = 'failed'
        this.persist()
        this.notify()
        return false
      }
    }
    return true
  }
}
