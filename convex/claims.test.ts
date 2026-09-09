/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

async function setup() {
  const t = convexTest(schema, modules)
  const id = await t.run((ctx) => ctx.db.insert('bills', {
    merchantName: 'Test bill', currencyPrimary: 'LBP', rate: 90000,
    rateSource: 'manual', serviceCharge: 0, tax: 0, serviceChargeOn: false,
    serviceSplitMode: 'proportional', shareToken: 'test-share-token',
    hostToken: 'test-host-token', status: 'PUBLISHED', version: 0, updatedAt: Date.now(),
    lineItems: ['meal', 'drink'].map((id) => ({ id, name: id, qty: 4, unitPrice: 100, lineTotal: 400 })),
    people: [
      { id: 'alice', name: 'Alice', color: 'red', guestSessionId: 'alice-session' },
      { id: 'bob', name: 'Bob', color: 'blue', guestSessionId: 'bob-session' },
      { id: 'companion', name: 'Companion', color: 'green', guestSessionId: 'alice-session' },
    ],
  }))
  return { t, id, host: { id, hostToken: 'test-host-token' }, guest: { shareToken: 'test-share-token', guestSessionId: 'alice-session' } }
}

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: taps made before a subscription update preserve both items`, async () => {
    const { t, id, host, guest } = await setup()
    // Send both intents without reading a fresh bill between taps.
    for (const itemId of ['meal', 'drink']) {
      if (caller === 'host') await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId: 'alice', itemId, delta: 1 })
      else await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId, delta: 1 })
    }
    const bill = await t.query(api.bills.host.queries.getBill, { id })
    expect(bill.claims).toEqual(expect.arrayContaining([
      { personId: 'alice', itemId: 'meal', units: 1 },
      { personId: 'alice', itemId: 'drink', units: 1 },
    ]))
  })
}

for (const caller of ['host', 'guest'] as const) {
  test(`${caller}: repeated taps accumulate and participant changes stay isolated`, async () => {
    const { t, id, host, guest } = await setup()
    async function step(personId: string, itemId: string, delta: 1 | -1) {
      return caller === 'host'
        ? t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId, itemId, delta })
        : t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId, itemId, delta })
    }
    await step('alice', 'meal', 1)
    await step('alice', 'meal', 1)
    await step('companion', 'drink', 1)
    await step('alice', 'meal', 1)
    await step('alice', 'meal', -1)
    const bill = await t.query(api.bills.host.queries.getBill, { id })
    expect(bill.claims).toEqual(expect.arrayContaining([
      { personId: 'alice', itemId: 'meal', units: 2 },
      { personId: 'companion', itemId: 'drink', units: 1 },
    ]))
    expect(bill.claims).toHaveLength(2)
  })
}

test('capacity conflicts are reported without discarding other items or people', async () => {
  const { t, id, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.shareHostItemEvenly, { ...host, itemId: 'meal', personIds: ['bob'] })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'drink', delta: 1 })
  const result = await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'meal', delta: 1 })
  expect(result.rejectedCount).toBe(1)
  const bill = await t.query(api.bills.host.queries.getBill, { id })
  expect(bill.claims).toEqual(expect.arrayContaining([
    { personId: 'bob', itemId: 'meal', units: 4 },
    { personId: 'alice', itemId: 'drink', units: 1 },
  ]))
})

test('guest even split is atomic, preserves other items, and respects ownership', async () => {
  const { t, id, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId: 'bob', itemId: 'meal', delta: 1 })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'drink', delta: 1 })
  const result = await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['alice', 'companion'] })
  expect(result.rejectedCount).toBe(1)
  const bill = await t.query(api.bills.host.queries.getBill, { id })
  expect(bill.claims).toEqual(expect.arrayContaining([
    { personId: 'bob', itemId: 'meal', units: 1 },
    { personId: 'alice', itemId: 'meal', units: 1.5 },
    { personId: 'companion', itemId: 'meal', units: 1.5 },
    { personId: 'alice', itemId: 'drink', units: 1 },
  ]))
  await expect(t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: ['alice', 'bob'] })).rejects.toThrow()
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'bob', itemId: 'meal', delta: -1 })).rejects.toThrow()
  expect((await t.query(api.bills.host.queries.getBill, { id })).claims).toEqual(bill.claims)
})

test('finalization preserves accepted choices and rejects later taps', async () => {
  const { t, id, host, guest } = await setup()
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId: 'alice', itemId: 'meal', delta: 1 })
  await t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId: 'alice', itemId: 'drink', delta: 1 })
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: 'alice', itemId: 'meal', delta: 1 })).rejects.toThrow()
  await expect(t.mutation(api.bills.host.claims.stepHostClaim, { ...host, personId: 'alice', itemId: 'meal', delta: 1 })).rejects.toThrow()
  const bill = await t.query(api.bills.host.queries.getBill, { id })
  expect(bill.status).toBe('FINALIZED')
  expect(bill.claims).toHaveLength(2)
})
