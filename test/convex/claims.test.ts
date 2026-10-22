import { convexTest } from 'convex-test'
import rateLimiter from '@convex-dev/rate-limiter/test'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from 'convex/_generated/api'
import { rateLimiter as limits } from 'convex/lib/rateLimits'
import { modules, schema } from './setup'

async function setup() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  const id = await t.run((ctx) =>
    ctx.db.insert('bills', {
      merchantName: 'Test bill',
      currencyPrimary: 'LBP',
      rate: 90000,
      rateSource: 'manual',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
      shareToken: 'test-share-token',
      hostToken: 'test-host-token',
      status: 'PUBLISHED',
      version: 0,
      updatedAt: Date.now(),
      lineItems: ['meal', 'drink'].map((id) => ({
        id,
        name: id,
        qty: 4,
        unitPrice: 100,
        lineTotal: 400,
      })),
      people: [
        {
          id: 'alice',
          name: 'Alice',
          color: 'red',
          guestSessionId: 'v2:alice-session-secret',
          guestAccessVersion: 2,
        },
        {
          id: 'bob',
          name: 'Bob',
          color: 'blue',
          guestSessionId: 'v2:bob-session-secret',
          guestAccessVersion: 2,
        },
        {
          id: 'companion',
          name: 'Companion',
          color: 'green',
          guestSessionId: 'v2:alice-session-secret',
          guestAccessVersion: 2,
        },
      ],
    }),
  )
  return {
    t,
    id,
    host: { id, hostToken: 'test-host-token' },
    guest: {
      shareToken: 'test-share-token',
      guestSessionId: 'v2:alice-session-secret',
    },
  }
}

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: taps made before a subscription update preserve both items`, async () => {
    const { t, id, host, guest } = await setup()
    // Send both intents without reading a fresh bill between taps.
    for (const itemId of ['meal', 'drink']) {
      if (caller === 'host')
        await t.mutation(api.bills.host.claims.stepHostClaim, {
          ...host,
          personId: 'alice',
          itemId,
          delta: 1,
        })
      else
        await t.mutation(api.bills.guest.claims.stepGuestClaim, {
          ...guest,
          personId: 'alice',
          itemId,
          delta: 1,
        })
    }
    const bill = await t.query(api.bills.host.queries.getBill, {
      id,
      hostToken: 'test-host-token',
    })
    expect(bill.claims).toEqual(
      expect.arrayContaining([
        { personId: 'alice', itemId: 'meal', units: 1 },
        { personId: 'alice', itemId: 'drink', units: 1 },
      ]),
    )
  })
}

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: repeated taps accumulate and participant changes stay isolated`, async () => {
    const { t, id, host, guest } = await setup()
    async function step(personId: string, itemId: string, delta: 1 | -1) {
      return caller === 'host'
        ? t.mutation(api.bills.host.claims.stepHostClaim, {
            ...host,
            personId,
            itemId,
            delta,
          })
        : t.mutation(api.bills.guest.claims.stepGuestClaim, {
            ...guest,
            personId,
            itemId,
            delta,
          })
    }
    await step('alice', 'meal', 1)
    await step('alice', 'meal', 1)
    await step('companion', 'drink', 1)
    await step('alice', 'meal', 1)
    await step('alice', 'meal', -1)
    const bill = await t.query(api.bills.host.queries.getBill, {
      id,
      hostToken: 'test-host-token',
    })
    expect(bill.claims).toEqual(
      expect.arrayContaining([
        { personId: 'alice', itemId: 'meal', units: 2 },
        { personId: 'companion', itemId: 'drink', units: 1 },
      ]),
    )
    expect(bill.claims).toHaveLength(2)
  })
}

test('capacity conflicts are reported without discarding other items or people', async () => {
  const { t, id, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.shareHostItemEvenly, {
    ...host,
    itemId: 'meal',
    personIds: ['bob'], quantity: 4,
  })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, {
    ...guest,
    personId: 'alice',
    itemId: 'drink',
    delta: 1,
  })
  const result = await t.mutation(api.bills.guest.claims.stepGuestClaim, {
    ...guest,
    personId: 'alice',
    itemId: 'meal',
    delta: 1,
  })
  expect(result.rejectedCount).toBe(1)
  const bill = await t.query(api.bills.host.queries.getBill, {
    id,
    hostToken: 'test-host-token',
  })
  expect(bill.claims).toEqual(
    expect.arrayContaining([
      { personId: 'bob', itemId: 'meal', units: 4 },
      { personId: 'alice', itemId: 'drink', units: 1 },
    ]),
  )
})

test('guest even split is atomic, preserves other items, and reaches anyone at the table', async () => {
  const { t, id, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.stepHostClaim, {
    ...host,
    personId: 'bob',
    itemId: 'meal',
    delta: 1,
  })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, {
    ...guest,
    personId: 'alice',
    itemId: 'drink',
    delta: 1,
  })
  const result = await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, {
    ...guest,
    itemId: 'meal',
    personIds: ['alice', 'companion'], quantity: 3,
  })
  expect(result.after).toHaveLength(3)
  const bill = await t.query(api.bills.host.queries.getBill, {
    id,
    hostToken: 'test-host-token',
  })
  expect(bill.claims).toEqual(
    expect.arrayContaining([
      { personId: 'bob', itemId: 'meal', units: 1 },
      { personId: 'alice', itemId: 'meal', units: 1.5 },
      { personId: 'companion', itemId: 'meal', units: 1.5 },
      { personId: 'alice', itemId: 'drink', units: 1 },
    ]),
  )
  // A joined guest may now unclaim for and share with another joined guest.
  await t.mutation(api.bills.guest.claims.stepGuestClaim, {
    ...guest,
    personId: 'bob',
    itemId: 'meal',
    delta: -1,
  })
  await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, {
    ...guest,
    itemId: 'meal',
    personIds: ['alice', 'bob'], quantity: 1,
  })
  const after = await t.query(api.bills.host.queries.getBill, {
    id,
    hostToken: 'test-host-token',
  })
  expect(after.claims).toEqual(
    expect.arrayContaining([
      { personId: 'bob', itemId: 'meal', units: 0.5 },
      { personId: 'alice', itemId: 'meal', units: 2 },
      { personId: 'companion', itemId: 'meal', units: 1.5 },
      { personId: 'alice', itemId: 'drink', units: 1 },
    ]),
  )
  // Sharing still never exceeds what is left, and unknown people are rejected.
  await expect(
    t.mutation(api.bills.guest.claims.shareGuestItemEvenly, {
      ...guest,
      itemId: 'meal',
      personIds: ['alice', 'bob'], quantity: 1,
    }),
  ).rejects.toThrow()
  await expect(
    t.mutation(api.bills.guest.claims.shareGuestItemEvenly, {
      ...guest,
      itemId: 'drink',
      personIds: ['alice', 'ghost'], quantity: 1,
    }),
  ).rejects.toThrow()
  await expect(
    t.mutation(api.bills.guest.claims.stepGuestClaim, {
      ...guest,
      personId: 'ghost',
      itemId: 'drink',
      delta: 1,
    }),
  ).rejects.toThrow()
  expect(
    (
      await t.query(api.bills.host.queries.getBill, {
        id,
        hostToken: 'test-host-token',
      })
    ).claims,
  ).toEqual(after.claims)
})

test('finalization preserves accepted choices and rejects later taps', async () => {
  const { t, id, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.stepHostClaim, {
    ...host,
    personId: 'alice',
    itemId: 'meal',
    delta: 1,
  })
  await t.mutation(api.bills.host.claims.stepHostClaim, {
    ...host,
    personId: 'alice',
    itemId: 'drink',
    delta: 1,
  })
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await expect(
    t.mutation(api.bills.guest.claims.stepGuestClaim, {
      ...guest,
      personId: 'alice',
      itemId: 'meal',
      delta: 1,
    }),
  ).rejects.toThrow()
  await expect(
    t.mutation(api.bills.host.claims.stepHostClaim, {
      ...host,
      personId: 'alice',
      itemId: 'meal',
      delta: 1,
    }),
  ).rejects.toThrow()
  const bill = await t.query(api.bills.host.queries.getBill, {
    id,
    hostToken: 'test-host-token',
  })
  expect(bill.status).toBe('FINALIZED')
  expect(bill.claims).toHaveLength(2)
})

test('separate guest splits add shares without removing earlier participants', async () => {
  const { t, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'meal', personId: 'bob', delta: 1 })
  await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['alice', 'companion'], quantity: 2 })
  await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['alice'], quantity: 1 })
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.claims).toHaveLength(3)
  expect(bill.claims).toEqual(expect.arrayContaining([
    { itemId: 'meal', personId: 'bob', units: 1 },
    { itemId: 'meal', personId: 'alice', units: 2 },
    { itemId: 'meal', personId: 'companion', units: 1 },
  ]))
})

test('host sharing deduplicates people and keeps exact thirds', async () => {
  const { t, host } = await setup()
  await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'meal', personIds: ['alice', 'bob', 'companion', 'alice'], quantity: 4 })
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.claims).toHaveLength(3)
  expect(bill.claims.every((c) => c.units === 4 / 3)).toBe(true)
  expect(bill.claims.reduce((sum, c) => sum + c.units, 0)).toBe(4)
})

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: undo restores prior quantities and leaves newer changes on other items alone`, async () => {
    const { t, host, guest } = await setup()
    await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'meal', personId: 'alice', delta: 1 })
    const result = caller === 'host'
      ? await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'meal', personIds: ['alice', 'companion'], quantity: 3 })
      : await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['alice', 'companion'], quantity: 3 })
    await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'drink', personId: 'bob', delta: 1 })
    const { before, after, qty } = result
    const snapshot = { itemId: 'meal', before, after, qty }
    if (caller === 'host') await t.mutation(api.bills.host.claims.restoreHostItemSplit, { ...host, ...snapshot })
    else await t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, ...snapshot })
    const bill = await t.query(api.bills.host.queries.getBill, host)
    expect(bill.claims).toHaveLength(2)
    expect(bill.claims).toEqual(expect.arrayContaining([
      { itemId: 'meal', personId: 'alice', units: 1 },
      { itemId: 'drink', personId: 'bob', units: 1 },
    ]))
    // The old snapshot cannot be replayed over a different split.
    await expect(caller === 'host'
      ? t.mutation(api.bills.host.claims.restoreHostItemSplit, { ...host, ...snapshot })
      : t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, ...snapshot }),
    ).rejects.toThrow('split changed')
  })
}

test('guest undo may restore other people’s shares but never exceeds the item quantity', async () => {
  const { t, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'meal', personId: 'bob', delta: 1 })
  const { before, after, qty } = await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['alice', 'companion'], quantity: 3 })
  for (const invalidBefore of [
    [...before, { itemId: 'meal', personId: 'alice', units: 10 }],
    [...before, { itemId: 'drink', personId: 'alice', units: 1 }],
    [...before, { itemId: 'meal', personId: 'ghost', units: 1 }],
  ]) {
    await expect(t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, itemId: 'meal', before: invalidBefore, after, qty })).rejects.toThrow()
  }
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(expect.arrayContaining(after))
  // Another joined guest's share is no longer off-limits to a joined guest.
  await t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, itemId: 'meal', before: before.map((c) => ({ ...c, units: 0.5 })), after, qty })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual([{ itemId: 'meal', personId: 'bob', units: 0.5 }])
})

async function withHostPerson() {
  const ctx = await setup()
  await ctx.t.run(async (run) => {
    const bill = await run.db.get(ctx.id)
    if (!bill) throw Error('missing fixture')
    await run.db.patch(ctx.id, { people: [{ id: 'host', name: 'Host', color: 'pink' }, ...bill.people] })
  })
  return ctx
}

test('a joined guest shares an item with the host’s person and another guest’s person', async () => {
  const { t, host, guest } = await withHostPerson()
  const result = await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['host', 'bob'], quantity: 2 })
  expect(result.after).toHaveLength(2)
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.claims).toHaveLength(2)
  expect(bill.claims).toEqual(expect.arrayContaining([
    { itemId: 'meal', personId: 'host', units: 1 },
    { itemId: 'meal', personId: 'bob', units: 1 },
  ]))
  // And can undo it again.
  await t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, itemId: 'meal', ...result })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual([])
})

test('a joined guest steps a claim for the host’s person', async () => {
  const { t, host, guest } = await withHostPerson()
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'host', itemId: 'drink', delta: 1 })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'host', itemId: 'drink', delta: 1 })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'host', itemId: 'drink', delta: -1 })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual([
    { itemId: 'drink', personId: 'host', units: 1 },
  ])
})

test('a well-formed session that never joined cannot step, share or undo', async () => {
  const { t, host, guest } = await withHostPerson()
  const stranger = { ...guest, guestSessionId: 'v2:never-joined-session-secret' }
  const snapshot = await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'meal', personIds: ['host', 'alice'], quantity: 2 })
  const before = (await t.query(api.bills.host.queries.getBill, host)).claims
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...stranger, personId: 'host', itemId: 'drink', delta: 1 })).rejects.toThrow('Join the table')
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...stranger, personId: 'alice', itemId: 'meal', delta: -1 })).rejects.toThrow('Join the table')
  await expect(t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...stranger, itemId: 'drink', personIds: ['host', 'bob'], quantity: 2 })).rejects.toThrow('Join the table')
  await expect(t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...stranger, itemId: 'meal', ...snapshot })).rejects.toThrow('Join the table')
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(before)
})

test('a guest whose people were all removed loses claim access', async () => {
  const { t, host, guest } = await withHostPerson()
  const bob = { ...guest, guestSessionId: 'v2:bob-session-secret' }
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...bob, personId: 'host', itemId: 'drink', delta: 1 })
  await t.mutation(api.bills.host.people.removeHostPerson, { ...host, personId: 'bob' })
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...bob, personId: 'host', itemId: 'drink', delta: 1 })).rejects.toThrow('Join the table')
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual([
    { itemId: 'drink', personId: 'host', units: 1 },
  ])
})

test('sharing and undo reject finalized bills', async () => {
  const { t, host, guest } = await setup()
  const { before, after, qty } = await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'meal', personIds: ['alice', 'companion'], quantity: 3 })
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await expect(t.mutation(api.bills.host.claims.restoreHostItemSplit, { ...host, itemId: 'meal', before, after, qty })).rejects.toThrow()
  await expect(t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, itemId: 'meal', before, after, qty })).rejects.toThrow()
  await expect(t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'meal', personIds: ['alice'], quantity: 1 })).rejects.toThrow()
})

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: sharing one order preserves a whole order already claimed by a recipient`, async () => {
    const { t, host, guest } = await setup()
    await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'meal', personId: 'alice', delta: 1 })
    const args = { itemId: 'meal', personIds: ['alice', 'companion'], quantity: 1 }
    if (caller === 'host') await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, ...args })
    else await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, ...args })
    const bill = await t.query(api.bills.host.queries.getBill, host)
    expect(bill.claims).toEqual(expect.arrayContaining([
      { itemId: 'meal', personId: 'alice', units: 1.5 },
      { itemId: 'meal', personId: 'companion', units: 0.5 },
    ]))
    expect(bill.claims.reduce((sum, c) => sum + c.units, 0)).toBe(2)
  })
}

test('two mozzarella orders: one solo order and another shared by three people', async () => {
  const { t, id, host } = await setup()
  await t.run(async (ctx) => {
    const bill = await ctx.db.get(id)
    if (!bill) throw Error('missing fixture')
    await ctx.db.patch(id, {
      lineItems: [{ id: 'mozzarella', name: 'Mozzarella sticks', qty: 2, unitPrice: 100, lineTotal: 200 }],
      people: [...bill.people, { id: 'dana', name: 'Dana', color: 'pink' }],
    })
  })
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'mozzarella', personId: 'alice', delta: 1 })
  const snapshot = await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'mozzarella', personIds: ['bob', 'companion', 'dana'], quantity: 1 })
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.claims).toHaveLength(4)
  expect(bill.claims.find((c) => c.personId === 'alice')?.units).toBe(1)
  expect(bill.claims.filter((c) => c.personId !== 'alice').every((c) => c.units === 1 / 3)).toBe(true)
  expect(bill.claims.reduce((sum, c) => sum + c.units, 0)).toBeCloseTo(2)
  const { before, after, qty } = snapshot
  await t.mutation(api.bills.host.claims.restoreHostItemSplit, { ...host, itemId: 'mozzarella', before, after, qty })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual([{ itemId: 'mozzarella', personId: 'alice', units: 1 }])
})

test('three nachos can all be split equally in one action', async () => {
  const { t, id, host } = await setup()
  await t.run((ctx) => ctx.db.patch(id, { lineItems: [{ id: 'nachos', name: 'Nachos', qty: 3, unitPrice: 100, lineTotal: 300 }] }))
  await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'nachos', personIds: ['alice', 'bob', 'companion'], quantity: 3 })
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.claims).toHaveLength(3)
  expect(bill.claims.every((c) => c.units === 1)).toBe(true)
})

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: invalid or stale quantities never overwrite claims`, async () => {
    const { t, host, guest } = await setup()
    await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, itemId: 'meal', personId: 'alice', delta: 1 })
    const before = (await t.query(api.bills.host.queries.getBill, host)).claims
    for (const quantity of [0, -1, NaN, Infinity, 4]) {
      const args = { itemId: 'meal', personIds: ['alice', 'companion'], quantity }
      await expect(caller === 'host'
        ? t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, ...args })
        : t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, ...args }),
      ).rejects.toThrow()
      expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(before)
    }
  })
}

// --- Guest claim rate limits ------------------------------------------------
// Date is frozen so token buckets never refill mid-test: a session gets exactly
// its burst capacity, which keeps the loops bounded by config, not wall time.

afterEach(() => {
  vi.useRealTimers()
})

function freezeTime() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T20:00:00Z'))
}

type Guest = { shareToken: string; guestSessionId: string }
type T = Awaited<ReturnType<typeof setup>>['t']

/** Tap +/- on one item until the session is throttled; returns accepted taps. */
async function tapUntilThrottled(t: T, guest: Guest, personId: string) {
  for (let accepted = 0; accepted < 500; accepted++) {
    try {
      await t.mutation(api.bills.guest.claims.stepGuestClaim, {
        ...guest, personId, itemId: 'meal', delta: accepted % 2 === 0 ? 1 : -1,
      })
    } catch (error) {
      expect(String(error)).toContain('too quickly')
      return accepted
    }
  }
  throw new Error('guest claim writes were never throttled')
}

test('a guest session that exceeds its burst is throttled and its claims stop changing', async () => {
  freezeTime()
  const { t, host, guest } = await setup()
  const accepted = await tapUntilThrottled(t, guest, 'alice')
  // Generous enough for a real guest tapping fast across a long receipt.
  expect(accepted).toBeGreaterThanOrEqual(40)
  const before = (await t.query(api.bills.host.queries.getBill, host)).claims
  // Every guest claim write shares the session bucket: step, share and undo.
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'drink', delta: 1 })).rejects.toThrow('too quickly')
  await expect(t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'drink', personIds: ['alice', 'bob'], quantity: 2 })).rejects.toThrow('too quickly')
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(before)
  // Host writes are not guest-limited.
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId: 'alice', itemId: 'drink', delta: 1 })
  // The bucket refills with time.
  vi.setSystemTime(new Date('2026-10-22T20:01:00Z'))
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'drink', delta: 1 })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(
    expect.arrayContaining([{ personId: 'alice', itemId: 'drink', units: 2 }]),
  )
})

test('throttling one guest session leaves other joined sessions at the table writable', async () => {
  freezeTime()
  const { t, host, guest } = await setup()
  await tapUntilThrottled(t, guest, 'alice')
  const bob = { ...guest, guestSessionId: 'v2:bob-session-secret' }
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...bob, personId: 'bob', itemId: 'drink', delta: 1 })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(
    expect.arrayContaining([{ personId: 'bob', itemId: 'drink', units: 1 }]),
  )
})

test('a session that never joined is refused before the limiter and never drains the table’s bucket', async () => {
  freezeTime()
  const { t, id, guest } = await setup()
  const perBill = () => t.run((ctx) => limits.getValue(ctx, 'guestClaimPerBill', { key: id }))
  const stranger = { ...guest, guestSessionId: 'v2:never-joined-session-secret' }
  for (let i = 0; i < 5; i++) {
    await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...stranger, personId: 'alice', itemId: 'meal', delta: 1 })).rejects.toThrow('Join the table')
  }
  const untouched = await perBill()
  expect(untouched.value).toBe(untouched.config.capacity)
  // Control: a joined session's tap does charge that same bucket.
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'meal', delta: 1 })
  expect((await perBill()).value).toBe(untouched.value - 1)
  // The join check runs before the limiter: even with the table's backstop
  // exhausted, a stranger is told to join, while a joined guest is throttled.
  await t.run((ctx) => limits.limit(ctx, 'guestClaimPerBill', { key: id, count: untouched.value - 1 }))
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...stranger, personId: 'alice', itemId: 'meal', delta: 1 })).rejects.toThrow('Join the table')
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'meal', delta: 1 })).rejects.toThrow('too quickly')
})
