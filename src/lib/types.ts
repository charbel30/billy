// Canonical shared types for the Receipt Splitter.
// Framework-agnostic: imported by both the browser (instant feedback) and Convex
// functions (server-side checks). Keep this file free of React/Convex imports.

export type RateSource = 'receipt' | 'market' | 'manual'
export type ServiceSplitMode = 'proportional' | 'even'
export type BillStatus = 'PENDING' | 'NEEDS_REVIEW' | 'READY' | 'PUBLISHED'

// ---------------------------------------------------------------------------
// In-document shapes — these mirror the JSON arrays stored inside the single
// `bills` row (convex/schema.ts). IDs are client-generated strings, unique
// within a bill; there are no Convex Ids inside the document.
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
  guestSessionId?: string
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
