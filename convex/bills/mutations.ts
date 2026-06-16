import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { invariant } from '../lib/invariant'
import { claim, lineItem, person } from '../schema'
import { metaValidator } from './validators'
import { DEFAULT_RATE, deriveRate } from '../../src/lib/currency'
import { DEFAULT_PERSON_NAME } from '../../src/lib/bill/constants'
import { newClientId, newShareToken, nextPersonColor } from '../../src/lib/bill/ids'
import { reconcileClaims } from '../../src/lib/bill/edits'

function definedOnly<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, val]) => val !== undefined),
  )
}

export const createBill = mutation({
  args: {
    merchantName: v.optional(v.string()),
    currencyPrimary: v.optional(v.string()),
  },
  returns: v.id('bills'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('bills', {
      merchantName: args.merchantName ?? '',
      currencyPrimary: args.currencyPrimary ?? 'LBP',
      rate: DEFAULT_RATE,
      rateSource: 'market',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
      shareToken: newShareToken(),
      status: 'PENDING',
      version: 0,
      lineItems: [],
      people: [
        {
          id: newClientId(),
          name: DEFAULT_PERSON_NAME,
          color: nextPersonColor(0),
        },
      ],
      claims: [],
    })
  },
})

export const saveWorking = mutation({
  args: {
    id: v.id('bills'),
    lineItems: v.optional(v.array(lineItem)),
    people: v.optional(v.array(person)),
    claims: v.optional(v.array(claim)),
    meta: v.optional(metaValidator),
  },
  returns: v.null(),
  handler: async (ctx, { id, lineItems, people, claims, meta }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    // A published bill is a frozen snapshot. Don't let a late flush mutate it.
    if (bill.status === 'PUBLISHED') return null

    const nextItems = lineItems ?? bill.lineItems
    const nextPeople = people ?? bill.people
    const nextClaims = reconcileClaims(
      nextItems,
      nextPeople,
      claims ?? bill.claims,
    )

    const patch: Record<string, unknown> = {
      lineItems: nextItems,
      people: nextPeople,
      claims: nextClaims,
      version: bill.version + 1,
      status: 'READY',
      ...definedOnly(meta ?? {}),
    }

    // Auto-derive the rate from printed totals unless the user set it manually.
    const printedLbp = meta?.printedTotalLbp ?? bill.printedTotalLbp
    const printedUsd = meta?.printedTotalUsd ?? bill.printedTotalUsd
    const nextRateSource = meta?.rateSource ?? bill.rateSource
    if (meta?.rate === undefined && nextRateSource !== 'manual') {
      const derived = deriveRate({
        printedTotalLbp: printedLbp,
        printedTotalUsd: printedUsd,
      })
      if (derived) {
        patch.rate = derived.rate
        patch.rateSource = derived.source
      }
    }

    await ctx.db.patch(id, patch)
    return null
  },
})

export const publish = mutation({
  args: { id: v.id('bills') },
  returns: v.string(),
  handler: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    if (bill.status !== 'PUBLISHED') {
      await ctx.db.patch(id, { status: 'PUBLISHED' })
    }
    return bill.shareToken
  },
})
