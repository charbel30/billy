// Custom function builders (convex-helpers) — the reusable seam every public
// bills function goes through. Each builder consumes the identity/lookup args
// (bill id, share token + guest session, device id), resolves and gates the
// bill, and injects the result into ctx, so handlers hold only domain logic.
// The consumed args stay part of the public wire API — clients call these
// functions exactly as before. Like validators.ts / claimRows.ts, this file
// registers no functions itself. Future cross-cutting concerns (auth,
// logging, transformations) belong in these builders, not in handlers.
import {
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions'
import { ConvexError, v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { invariant } from '../../lib/invariant'
import { rateLimiter } from '../../lib/rateLimits'
import type { Bill } from '../../schema'
import {
  assertEditableSplit,
  assertGuestSessionId,
  assertHostToken,
  assertSettleOpen,
  assertSharedForGuestWrites,
  getBillByShareToken,
} from '../../model/bills'

// ---------------------------------------------------------------------------
// Host side. Capability = the bill's `hostToken`, NOT its id: the id is in the
// address bar and in browser history, so a pasted /split/$billId URL would
// otherwise hand a stranger the ability to edit line items, revoke the share
// link and finalize the bill. The token is minted server-side by createBill,
// returned once, and kept per-bill in localStorage on the host's device
// (src/lib/session/hostToken.ts). Consumes `id` + `hostToken`, injects
// `ctx.bill`; handlers write via `ctx.bill._id` and never see the token.
// ---------------------------------------------------------------------------

function makeBillMutation(gate?: (bill: Bill) => void) {
  return customMutation(mutation, {
    args: { id: v.id('bills'), hostToken: v.string() },
    input: async (ctx, { id, hostToken }) => {
      const bill = await ctx.db.get(id)
      invariant(bill, `missing bill ${id}`)
      // Capability first, status second: a caller without the token learns
      // nothing about the bill, not even which lifecycle stage it's in.
      assertHostToken(bill, hostToken)
      gate?.(bill)
      return { ctx: { bill }, args: {} }
    },
  })
}

/** Bill resolved, no status gate — the handler decides (publish, saveWorking…). */
export const billMutation = makeBillMutation()
/** Claims/items/people edits: anything until FINALIZED freezes the bill. */
export const editableBillMutation = makeBillMutation(assertEditableSplit)
/** Mark-as-paid window: PUBLISHED or FINALIZED (settling outlives finalize). */
export const settleBillMutation = makeBillMutation(assertSettleOpen)

// ---------------------------------------------------------------------------
// Guest side. Capability = share token + own session id. Consumes both,
// injects `ctx.bill` and `ctx.guestSessionId`.
// ---------------------------------------------------------------------------

function makeGuestMutation(gate: (bill: Bill) => void) {
  return customMutation(mutation, {
    args: { shareToken: v.string(), guestSessionId: v.string() },
    input: async (ctx, { shareToken, guestSessionId }) => {
      assertGuestSessionId(guestSessionId)
      const bill = await getBillByShareToken(ctx, shareToken)
      gate(bill)
      return { ctx: { bill, guestSessionId }, args: {} }
    },
  })
}

/** Join/claim writes: only while the split is live (PUBLISHED). */
export const guestMutation = makeGuestMutation(assertSharedForGuestWrites)
/** Guest mark-as-paid: same settle window as the host side. */
export const guestSettleMutation = makeGuestMutation(assertSettleOpen)

// ---------------------------------------------------------------------------
// Scan side. Public + unauthenticated, so every entry point is rate limited
// per device (client-generated id). Consumes `deviceId`; `gate` runs before
// the limiter so an emergency brake doesn't burn tokens.
// ---------------------------------------------------------------------------

type DeviceLimit =
  | 'createBillPerDevice'
  | 'uploadUrlPerDevice'
  | 'extractPerDevice'

function assertDeviceId(deviceId: string) {
  if (deviceId.trim().length < 8) {
    throw new ConvexError('Invalid device id')
  }
}

export function deviceLimitedMutation(
  limit: DeviceLimit,
  limitMessage: string,
  gate?: () => void,
) {
  return customMutation(mutation, {
    args: { deviceId: v.string() },
    input: async (ctx, { deviceId }) => {
      assertDeviceId(deviceId)
      gate?.()
      const { ok } = await rateLimiter.limit(ctx, limit, { key: deviceId })
      if (!ok) throw new ConvexError(limitMessage)
      return { ctx: {}, args: {} }
    },
  })
}

/** Scan-side write against an EXISTING bill (the "scan again" path). It's rate
 *  limited like the rest of the scan flow, but it also overwrites that bill's
 *  line items — a host write — so it takes the host capability too. The token
 *  check runs before the limiters, so an unauthorized caller is rejected
 *  without ever reaching the paid extraction budget. */
export function deviceLimitedBillMutation(
  limit: DeviceLimit,
  limitMessage: string,
  gate?: () => void,
) {
  return customMutation(mutation, {
    args: { deviceId: v.string(), id: v.id('bills'), hostToken: v.string() },
    input: async (ctx, { deviceId, id, hostToken }) => {
      assertDeviceId(deviceId)
      gate?.()
      const bill = await ctx.db.get(id)
      invariant(bill, `missing bill ${id}`)
      assertHostToken(bill, hostToken)
      const { ok } = await rateLimiter.limit(ctx, limit, { key: deviceId })
      if (!ok) throw new ConvexError(limitMessage)
      return { ctx: { bill }, args: {} }
    },
  })
}

// ---------------------------------------------------------------------------
// Reads. Same identity seams as the mutations, so auth/visibility rules can
// later land in one place for reads and writes alike.
//
// billQuery deliberately does NOT require the host token, i.e. the bill id
// still authorizes a READ. Three reasons:
//   1. It grants nothing the guest path doesn't. Both queries return the same
//      document, and it carries `shareToken` — so a bill id and a share link
//      confer the same access, and that access is read + guest-level writes
//      only. Token-gating the read would not remove a write capability.
//   2. /summary and /split are the host's own screens and are prefetched in
//      route loaders during SSR, where localStorage (and therefore the token)
//      does not exist. Gating reads would mean giving up SSR on every host
//      screen to close nothing from (1).
//   3. Bill ids are Convex ids, not enumerable — a read requires the URL to
//      have actually leaked.
// What both queries must never do is return the capability itself: they build
// their response with toWireBill (convex/model/bills.ts), which strips
// hostToken, and billDocValidator omits it so a regression fails loudly.
// ---------------------------------------------------------------------------

export const billQuery = customQuery(query, {
  args: { id: v.id('bills') },
  input: async (ctx, { id }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, `missing bill ${id}`)
    return { ctx: { bill }, args: {} }
  },
})

export const sharedBillQuery = customQuery(query, {
  args: { shareToken: v.string() },
  input: async (ctx, { shareToken }) => {
    return { ctx: { bill: await getBillByShareToken(ctx, shareToken) }, args: {} }
  },
})
