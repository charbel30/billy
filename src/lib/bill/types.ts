import type {
  BillStatus,
  LineItem,
  Person,
  RateSource,
  ServiceSplitMode,
} from '../types'

export interface WorkingMeta {
  merchantName: string
  branch?: string
  datetime?: string
  currencyPrimary: string
  rate?: number
  rateSource: RateSource
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  printedTotalLbp?: number
  printedTotalUsd?: number
}

// Claims are NOT part of the working copy: they live in their own `claims`
// table, written only by the scoped claim mutations (split/join screens). The
// review editor never edits them; saveWorking reconciles the rows server-side
// when items/people change.
export interface WorkingBill {
  lineItems: LineItem[]
  people: Person[]
  meta: WorkingMeta
  version: number
  status: BillStatus
}

export type SaveState = 'unsaved' | 'saving' | 'saved' | 'failed'

export interface BillEditor {
  bill: WorkingBill
  status: BillStatus
  saving: boolean
  saveState: SaveState
  recoveryUnavailable: boolean
  useServerVersion: () => void
  keepLocalVersion: () => void
  editedElsewhere: boolean
  /** True while the vision model is still reading an attached image. */
  extracting: boolean
  setMeta: (patch: Partial<WorkingMeta>) => void
  addLineItem: (item?: Partial<LineItem>) => void
  updateLineItem: (id: string, patch: Partial<LineItem>) => void
  removeLineItem: (id: string) => void
  addPerson: (name: string) => void
  updatePerson: (id: string, patch: Partial<Person>) => void
  removePerson: (id: string) => void
  flushNow: () => Promise<boolean>
}
