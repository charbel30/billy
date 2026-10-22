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
  assertSessionAtTable,
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

const GUEST_CLAIM_RATE_LIMIT_MESSAGE =
  "You're changing claims too quickly — wait a moment and try again."

/**
 * Guest claim writes (step / share evenly / undo). Same capability + PUBLISHED
 * gate as guestMutation, then:
 *   1. the session must have joined the table (assertSessionAtTable) — checked
 *      BEFORE the limiter, so a link holder who never joined always gets "Join
 *      the table" (even on a throttled table) and never reaches the buckets;
 *   2. charge the per-session bucket, then the per-bill backstop.
 * Limiter writes are transactional with the mutation: any throw (a limit hit
 * here, or a handler error later) rolls back every charge in this call, so a
 * per-bill rejection never leaves a per-session charge, and only committed
 * claim writes spend tokens.
 * Injects `ctx.bill`, `ctx.guestSessionId` and `ctx.tableIds` (every person id
 * on the bill — the set a joined guest may claim for).
 */
export const guestClaimMutation = customMutation(mutation, {
  args: { shareToken: v.string(), guestSessionId: v.string() },
  input: async (ctx, { shareToken, guestSessionId }) => {
    assertGuestSessionId(guestSessionId)
    const bill = await getBillByShareToken(ctx, shareToken)
    assertSharedForGuestWrites(bill)
    const tableIds = assertSessionAtTable(bill, guestSessionId)
    const perSession = await rateLimiter.limit(ctx, 'guestClaimPerSession', {
      key: `${bill._id}:${guestSessionId}`,
    })
    if (!perSession.ok) throw new ConvexError(GUEST_CLAIM_RATE_LIMIT_MESSAGE)
    const perBill = await rateLimiter.limit(ctx, 'guestClaimPerBill', {
      key: bill._id,
    })
    if (!perBill.ok) throw new ConvexError(GUEST_CLAIM_RATE_LIMIT_MESSAGE)
    return { ctx: { bill, guestSessionId, tableIds }, args: {} }
  },
})

// ---------------------------------------------------------------------------
// Scan side. Public + unauthenticated, so every entry point is rate limited
// per device (client-generated id). Consumes `deviceId`; `gate` runs before
// the limiter so an emergency brake doesn't burn tokens.
// ---------------------------------------------------------------------------

type DeviceLimit =
  | 'createBillPerDevice'
  | 'uploadUrlPerDevice'
  | 'extractPerDevice'

export function assertDeviceId(deviceId: string) {
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
// Host reads require the same capability as writes. Host routes render a
// public shell during SSR; receipt data loads after browser storage is ready.
// ---------------------------------------------------------------------------

export const billQuery = customQuery(query, {
  args: { id: v.id('bills'), hostToken: v.string() },
  input: async (ctx, { id, hostToken }) => {
    const bill = await ctx.db.get(id)
    invariant(bill, 'Bill unavailable')
    assertHostToken(bill, hostToken)
    return { ctx: { bill }, args: {} }
  },
})

export const sharedBillQuery = customQuery(query, {
  args: { shareToken: v.string() },
  input: async (ctx, { shareToken }) => {
    const bill = await getBillByShareToken(ctx, shareToken)
    assertSettleOpen(bill)
    return { ctx: { bill }, args: {} }
  },
})
