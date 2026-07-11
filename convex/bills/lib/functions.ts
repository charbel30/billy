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
  assertSettleOpen,
  assertSharedForGuestWrites,
  getBillByShareToken,
} from '../../model/bills'

// ---------------------------------------------------------------------------
// Host side. Capability = knowing the bill id. Consumes `id`, injects
// `ctx.bill`; handlers write via `ctx.bill._id`.
// ---------------------------------------------------------------------------

function makeBillMutation(gate?: (bill: Bill) => void) {
  return customMutation(mutation, {
    args: { id: v.id('bills') },
    input: async (ctx, { id }) => {
      const bill = await ctx.db.get(id)
      invariant(bill, `missing bill ${id}`)
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

export function deviceLimitedMutation(
  limit: DeviceLimit,
  limitMessage: string,
  gate?: () => void,
) {
  return customMutation(mutation, {
    args: { deviceId: v.string() },
    input: async (ctx, { deviceId }) => {
      if (deviceId.trim().length < 8) {
        throw new ConvexError('Invalid device id')
      }
      gate?.()
      const { ok } = await rateLimiter.limit(ctx, limit, { key: deviceId })
      if (!ok) throw new ConvexError(limitMessage)
      return { ctx: {}, args: {} }
    },
  })
}

// ---------------------------------------------------------------------------
// Reads. Same identity seams as the mutations, so auth/visibility rules can
// later land in one place for reads and writes alike.
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
