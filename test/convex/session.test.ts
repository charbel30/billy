import { convexTest } from 'convex-test'
import rateLimiter from '@convex-dev/rate-limiter/test'
import { expect, test } from 'vitest'
import { api } from 'convex/_generated/api'
import { modules, schema } from './setup'

async function session() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  const { billId, hostToken } = await t.mutation(api.bills.host.lifecycle.createBill, {
    deviceId: 'session-test-device', merchantName: 'Session test',
  })
  const host = { id: billId, hostToken }
  const initial = await t.query(api.bills.host.queries.getBill, host)
  await t.mutation(api.bills.host.lifecycle.saveWorking, {
    ...host, baseVersion: initial.version,
    people: initial.people.map((p) => ({ ...p, name: 'Host' })),
    lineItems: [{ id: 'meal', name: 'Meal', qty: 4, unitPrice: 90000, lineTotal: 360000 }],
  })
  const shareToken = await t.mutation(api.bills.host.lifecycle.publish, host)
  const guest = { shareToken, guestSessionId: 'v2:session-test-john' }
  const john = await t.mutation(api.bills.guest.people.joinSplit, { ...guest, name: 'John' })
  return { t, host, guest, john: john.personId, hostPerson: initial.people[0].id }
}

test('create, publish, join, rejoin and companion additions preserve one shared table', async () => {
  const { t, host, guest, john, hostPerson } = await session()
  expect(await t.mutation(api.bills.guest.people.joinSplit, { ...guest, name: 'John' })).toEqual({ personId: john })
  const companion = await t.mutation(api.bills.guest.people.addGuestPerson, { ...guest, name: 'Companion' })
  const jane = await t.mutation(api.bills.guest.people.joinSplit, { ...guest, guestSessionId: 'v2:session-test-jane', name: 'Jane' })
  const hostBill = await t.query(api.bills.host.queries.getBill, host)
  const guestBill = await t.query(api.bills.guest.queries.getBillByToken, { shareToken: guest.shareToken })
  expect(guestBill._id).toBe(host.id)
  expect(guestBill.people).toEqual(hostBill.people)
  expect(guestBill.people.map((p) => p.id)).toEqual([hostPerson, john, companion.personId, jane.personId])
  expect(await t.query(api.bills.guest.queries.getControlledPeople, guest)).toEqual([john, companion.personId])
})

test('host removal clears claims and ownership without dropping the guest’s companion', async () => {
  const { t, host, guest, john } = await session()
  const companion = await t.mutation(api.bills.guest.people.addGuestPerson, { ...guest, name: 'Companion' })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: john, itemId: 'meal', delta: 1 })
  await t.mutation(api.bills.host.people.removeHostPerson, { ...host, personId: john })
  const bill = await t.query(api.bills.guest.queries.getBillByToken, { shareToken: guest.shareToken })
  expect(bill.people.some((p) => p.id === john)).toBe(false)
  expect(bill.claims).toEqual([])
  expect(await t.query(api.bills.guest.queries.getControlledPeople, guest)).toEqual([companion.personId])
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: john, itemId: 'meal', delta: 1 })).rejects.toThrow()
})

test('host additions, tips, leftovers and settlement reach the guest query', async () => {
  const { t, host, guest, john, hostPerson } = await session()
  await t.mutation(api.bills.host.people.addHostPerson, { ...host, name: 'Friend' })
  await t.mutation(api.bills.host.lifecycle.setTipPercent, { ...host, tipPercent: 15 })
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: john, itemId: 'meal', delta: 1 })
  await t.mutation(api.bills.host.claims.splitLeftoversEvenly, host)
  let bill = await t.query(api.bills.guest.queries.getBillByToken, { shareToken: guest.shareToken })
  expect(bill.tipPercent).toBe(15)
  expect(bill.people).toHaveLength(3)
  expect(bill.claims.reduce((sum, c) => sum + c.units, 0)).toBe(4)
  expect(bill.claims.find((c) => c.personId === john)?.units).toBe(2)
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await t.mutation(api.bills.guest.people.setGuestPersonPaid, { ...guest, personId: john, paid: true })
  await t.mutation(api.bills.host.people.setHostPersonPaid, { ...host, personId: hostPerson, paid: true })
  bill = await t.query(api.bills.guest.queries.getBillByToken, { shareToken: guest.shareToken })
  expect(bill.status).toBe('FINALIZED')
  expect(bill.people.find((p) => p.id === john)?.paidAt).toEqual(expect.any(Number))
  expect(bill.people.find((p) => p.id === hostPerson)?.paidAt).toEqual(expect.any(Number))
  await expect(t.mutation(api.bills.guest.people.joinSplit, { ...guest, name: 'Too late' })).rejects.toThrow()
})

test('demo creation works through its real rate limiter and rejects invalid devices', async () => {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  const demo = await t.mutation(api.bills.host.lifecycle.createDemoBill, { deviceId: 'demo-test-device' })
  const bill = await t.query(api.bills.host.queries.getBill, { id: demo.billId, hostToken: demo.hostToken })
  expect(bill.lineItems.length).toBeGreaterThan(0)
  expect(bill.people).toHaveLength(1)
  await expect(t.mutation(api.bills.host.lifecycle.createBill, { deviceId: '' })).rejects.toThrow('Invalid device')
})
