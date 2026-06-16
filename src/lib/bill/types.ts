import type {
  BillStatus,
  Claim,
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

export interface WorkingBill {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  meta: WorkingMeta
  version: number
  status: BillStatus
}

export interface BillEditor {
  bill: WorkingBill
  status: BillStatus
  saving: boolean
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
  setClaim: (itemId: string, personId: string, units: number) => void
  stepClaim: (itemId: string, personId: string, delta: number) => void
  shareEvenly: (itemId: string, personIds: string[]) => void
  flushNow: () => Promise<boolean>
}
