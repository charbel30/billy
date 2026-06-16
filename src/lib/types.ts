// Canonical shared types for the Receipt Splitter.
// Framework-agnostic: imported by both the browser (instant feedback) and Convex
// functions (server-side checks). Keep this file free of React/Convex imports.

export type RateSource = 'receipt' | 'market' | 'manual'
export type ServiceSplitMode = 'proportional' | 'even'
export type BillStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'READY' | 'SHARED'

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

// ---------------------------------------------------------------------------
// App-level inputs for the pure logic functions. These mirror the Convex docs
// (camelCase) but only the fields the logic needs, so the functions stay
// decoupled from the generated Doc<> types. `_id` is the Convex document id.
// ---------------------------------------------------------------------------

export interface LineItemInput {
  _id: string
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
  currency: string
  confidence?: number
}

export interface PersonInput {
  _id: string
  name: string
  color: string
}

export interface AssignmentInput {
  _id: string
  lineItemId: string
  personId: string
  shareFraction: number
}
