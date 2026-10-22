import { v } from 'convex/values'
import {
  billStatus,
  claim,
  lineItem,
  rateSource,
  serviceSplitMode,
} from '../../schema'

export const itemSplitSnapshot = {
  before: v.array(claim),
  after: v.array(claim),
  qty: v.number(),
}

export const itemShareResult = v.object({
  ...itemSplitSnapshot,
})

export const publicPerson = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  paidAt: v.optional(v.number()),
  // Public marker for the host's own person. Accepted in saveWorking payloads
  // only because the wire carries it; the server always ignores the sent value.
  isHost: v.optional(v.boolean()),
})

export const billDocValidator = v.object({
  _id: v.id('bills'),
  _creationTime: v.number(),
  ownerId: v.optional(v.id('users')),
  merchantName: v.string(),
  branch: v.optional(v.string()),
  datetime: v.optional(v.string()),
  currencyPrimary: v.string(),
  rate: v.optional(v.number()),
  rateSource,
  serviceCharge: v.number(),
  tax: v.number(),
  serviceChargeOn: v.boolean(),
  serviceSplitMode,
  // Deliberately NOT in metaValidator below: tip changes only go through
  // setTipPercent, so a stale saveWorking flush can never clobber it.
  tipPercent: v.optional(v.number()),
  printedTotalLbp: v.optional(v.number()),
  printedTotalUsd: v.optional(v.number()),
  imageRef: v.optional(v.string()),
  shareToken: v.string(),
  // `hostToken` is deliberately ABSENT: it is the host's write capability, and
  // this validator is the return type of BOTH getBill and getBillByToken (which
  // anyone with the share link can call). Queries strip it via toWireBill; if a
  // handler ever forgets, Convex rejects the response against this validator.
  status: billStatus,
  extractionError: v.optional(v.string()),
  extractionRunId: v.optional(v.string()),
  version: v.number(),
  updatedAt: v.number(),
  lineItems: v.array(lineItem),
  people: v.array(publicPerson),
  claims: v.array(claim),
  guestAccessReset: v.boolean(),
})

// What createBill/createDemoBill hand back: the id (goes in the URL) plus the
// host capability (goes in localStorage, never in the URL). This is the ONLY
// response that ever contains a hostToken.
export const createdBillValidator = v.object({
  billId: v.id('bills'),
  hostToken: v.string(),
})

export const metaValidator = v.object({
  merchantName: v.optional(v.string()),
  branch: v.optional(v.string()),
  datetime: v.optional(v.string()),
  currencyPrimary: v.optional(v.string()),
  rate: v.optional(v.number()),
  rateSource: v.optional(rateSource),
  serviceCharge: v.optional(v.number()),
  tax: v.optional(v.number()),
  serviceChargeOn: v.optional(v.boolean()),
  serviceSplitMode: v.optional(serviceSplitMode),
  printedTotalLbp: v.optional(v.number()),
  printedTotalUsd: v.optional(v.number()),
})

// Claim input as submitted by hosts/guests — a (itemId, units) pair; personId
// comes from the mutation's own args.
export const claimInputValidator = v.object({
  itemId: v.string(),
  units: v.number(),
})

export const extractedLineItemValidator = v.object({
  name: v.string(),
  qty: v.number(),
  unit_price: v.number(),
  line_total: v.number(),
  confidence: v.optional(v.number()),
})

export const extractedReceiptValidator = v.object({
  merchant: v.optional(v.string()),
  branch: v.optional(v.string()),
  datetime: v.optional(v.string()),
  currency_primary: v.string(),
  line_items: v.array(extractedLineItemValidator),
  service_charge: v.number(),
  tax: v.number(),
  printed_total_lbp: v.optional(v.union(v.number(), v.null())),
  printed_total_usd: v.optional(v.union(v.number(), v.null())),
})
