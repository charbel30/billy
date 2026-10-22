// Canonical shared types for the Receipt Splitter.
// Framework-agnostic: imported by both the browser (instant feedback) and Convex
// functions (server-side checks). Keep this file free of React/Convex imports.

export type RateSource = 'receipt' | 'market' | 'manual'
export type ServiceSplitMode = 'proportional' | 'even'
export type BillStatus =
  | 'PENDING'
  | 'NEEDS_REVIEW'
  | 'READY'
  | 'PUBLISHED'
  | 'FINALIZED'

// ---------------------------------------------------------------------------
// Bill entity shapes (convex/schema.ts). LineItem/Person mirror the JSON
// arrays embedded in the `bills` row; Claim is the wire shape of a `claims`
// table row (storage adds billId — queries strip it when assembling the bill).
// IDs are client-generated strings, unique within a bill.
// ---------------------------------------------------------------------------

export interface LineItem {
  id: string
  name: string
  qty: number
  unitPrice: number
  /** Source of truth. effectiveUnitPrice = lineTotal / qty. */
  lineTotal: number
  /** <1 lowers trust; surfaced as a "check this" flag in review. */
  confidence?: number
}

export interface Person {
  id: string
  name: string
  color: string
  /** Settle-up: ms timestamp of when this person was marked paid.
   *  Self-reported social signal — render as a checkmark, not accounting. */
  paidAt?: number
  /** The host's own person (server-set; see hostPersonId in lib/bill/hostPerson.ts). */
  isHost?: boolean
}

/** A (person, item) claim of a fractional number of units. */
export interface Claim {
  itemId: string
  personId: string
  units: number
}

// ---------------------------------------------------------------------------
// Extraction shape — the strict JSON we ask the vision-LLM to return.
// snake_case because that's what the model emits (spec §4.2).
// ---------------------------------------------------------------------------

export interface ExtractedLineItem {
  name: string
  qty: number
  unit_price: number
  line_total: number
  confidence?: number
}

export interface ExtractedReceipt {
  merchant?: string
  branch?: string
  datetime?: string
  currency_primary: string
  line_items: ExtractedLineItem[]
  service_charge: number
  tax: number
  printed_total_lbp?: number | null
  printed_total_usd?: number | null
}
