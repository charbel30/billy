import { v } from 'convex/values'
import {
  billStatus,
  claim,
  lineItem,
  person,
  rateSource,
  serviceSplitMode,
} from '../schema'

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
  printedTotalLbp: v.optional(v.number()),
  printedTotalUsd: v.optional(v.number()),
  imageRef: v.optional(v.string()),
  shareToken: v.string(),
  status: billStatus,
  version: v.number(),
  updatedAt: v.optional(v.number()),
  lineItems: v.array(lineItem),
  people: v.array(person),
  claims: v.array(claim),
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
