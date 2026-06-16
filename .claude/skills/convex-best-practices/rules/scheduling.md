# Scheduling: crons & the scheduler

## Recurring jobs — `convex/crons.ts`

Define recurring work with `cronJobs()` and point it at an `internal*` function (see the
existing `convex/crons.ts`, which clears the demo board on a schedule):

```ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
// Phase-2 FX refresh: pull a parallel rate daily and cache it.
crons.cron('refresh fx rate', '0 6 * * *', internal.fx.refreshRate)
// Privacy TTL: purge stored receipt images on a cadence.
crons.interval('purge old images', { hours: 6 }, internal.images.purgeExpired)
export default crons
```

Cron handlers must be `internalMutation` or `internalAction` (an FX fetch needs an action;
a pure DB cleanup is a mutation).

## One-off / deferred work — the scheduler

From a mutation or action, kick off background work without blocking the response:

```ts
await ctx.scheduler.runAfter(0, internal.extract.extractReceipt, { billId, imageStorageId })
```

Use this to start the vision-LLM extraction right after a bill+image are created, so the
mutation returns immediately and the UI can show a "processing" state while the action runs.
