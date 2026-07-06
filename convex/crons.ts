import { cronJobs } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'

// Bills are anonymous and unowned in the MVP, so they must not accumulate
// forever (spec §10 asks for a TTL). A bill untouched for BILL_TTL_MS is
// purged; "touched" = any saveWorking/claim/publish (they all bump updatedAt).
const BILL_TTL_MS = 60 * 24 * 60 * 60 * 1000 // 60 days
const PURGE_BATCH = 100

export const purgeStaleBills = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - BILL_TTL_MS
    const candidates = await ctx.db
      .query('bills')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', cutoff))
      .take(PURGE_BATCH)
    for (const bill of candidates) {
      await ctx.db.delete(bill._id)
    }
    // Full batch means there may be more; continue in a fresh transaction.
    if (candidates.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.crons.purgeStaleBills, {})
    }
    return null
  },
})

const crons = cronJobs()

crons.interval(
  'purge stale bills',
  { hours: 24 },
  internal.crons.purgeStaleBills,
  {},
)

export default crons
