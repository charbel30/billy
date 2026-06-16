import { defineSchema, defineTable } from 'convex/server'
import { type Infer, v } from 'convex/values'

// Receipt Splitter data model (spec §6.2). Foreign keys use v.id('table') for
// type-safe references; every relation has an index so children are fetched with
// .withIndex() rather than a full-table scan. System fields _id / _creationTime
// come for free — never redefine them.

export const rateSource = v.union(
  v.literal('receipt'),
  v.literal('market'),
  v.literal('manual'),
)
export const serviceSplitMode = v.union(
  v.literal('proportional'),
  v.literal('even'),
)
export const billStatus = v.union(
  v.literal('DRAFT'),
  v.literal('NEEDS_REVIEW'),
  v.literal('READY'),
  v.literal('SHARED'),
)

const schema = defineSchema({
  bills: defineTable({
    ownerId: v.optional(v.id('users')), // users table omitted in MVP; optional for later
    merchantName: v.string(),
    branch: v.optional(v.string()),
    datetime: v.optional(v.string()),
    currencyPrimary: v.string(), // usually "LBP"
    rate: v.optional(v.number()), // LBP per USD
    rateSource,
    serviceCharge: v.number(),
    tax: v.number(),
    serviceSplitMode,
    printedTotalLbp: v.optional(v.number()),
    printedTotalUsd: v.optional(v.number()),
    // Storage-agnostic image ref: a Convex storageId string today, a Cloudflare
    // R2 object key after the planned backend swap. See convex/imageStore.ts.
    imageRef: v.optional(v.string()),
    shareToken: v.string(), // unguessable
    status: billStatus,
  }).index('by_share_token', ['shareToken']),

  lineItems: defineTable({
    billId: v.id('bills'),
    name: v.string(),
    qty: v.number(),
    unitPrice: v.number(),
    lineTotal: v.number(),
    currency: v.string(),
    confidence: v.optional(v.number()),
  }).index('by_bill', ['billId']),

  people: defineTable({
    billId: v.id('bills'),
    name: v.string(),
    color: v.string(),
  }).index('by_bill', ['billId']),

  assignments: defineTable({
    billId: v.id('bills'), // denormalized so a whole bill loads in one indexed read
    lineItemId: v.id('lineItems'),
    personId: v.id('people'),
    shareFraction: v.number(), // 0..1; equal shares by default
  })
    .index('by_bill', ['billId'])
    .index('by_line_item', ['lineItemId'])
    .index('by_person', ['personId']),
})
export default schema

const bill = schema.tables.bills.validator
const lineItem = schema.tables.lineItems.validator
const person = schema.tables.people.validator

export type Bill = Infer<typeof bill>
export type LineItem = Infer<typeof lineItem>
export type Person = Infer<typeof person>
