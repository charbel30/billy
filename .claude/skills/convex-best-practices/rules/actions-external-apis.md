# Actions & external APIs (the extraction / FX calls)

Queries and mutations run in a deterministic, side-effect-free environment: **no `fetch`, no
Node APIs, no randomness that escapes the transaction.** Any call to a vision-LLM, an FX-rate
provider, or any third-party HTTP service MUST be an `action`.

## The action → mutation pattern

An action has no `ctx.db`. It does the external work, then persists results by calling a
mutation. Keep the DB write transactional and minimal.

```ts
// convex/extract.ts
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const extractReceipt = internalAction({
  args: { billId: v.id('bills'), imageStorageId: v.id('_storage') },
  handler: async (ctx, { billId, imageStorageId }) => {
    const imageUrl = await ctx.storage.getUrl(imageStorageId)
    // External vision-LLM call — only legal inside an action:
    const res = await fetch(process.env.LLM_ENDPOINT!, { /* ... */ })
    const parsed = await res.json()
    // Persist via a mutation (actions can't touch ctx.db directly):
    await ctx.runMutation(internal.bills.applyExtraction, { billId, parsed })
  },
})
```

- Make the LLM/FX functions `internalAction` so they are never callable from the browser.
- Secrets (LLM API key) live in Convex environment variables (`npx convex env set ...`),
  read via `process.env` inside the action — never shipped to the client.
- The default Convex runtime supports `fetch`. Only add `"use node"` at the top of a file if
  you genuinely need a Node-only library; it is slower to cold-start, so avoid it otherwise.
- Actions are NOT transactional and can run more than once on retry — make the final mutation
  idempotent (e.g. key on `billId`) so a retry doesn't duplicate data.
- Trigger the action from the client with `useAction`, or schedule it from a mutation with
  `ctx.scheduler.runAfter(0, internal.extract.extractReceipt, {...})`.
