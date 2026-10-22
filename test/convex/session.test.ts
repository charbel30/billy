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

test('guests cannot join or add people under the host’s reserved names', async () => {
  const { t, host, guest, john } = await session()
  const before = (await t.query(api.bills.host.queries.getBill, host)).people
  const newcomer = { ...guest, guestSessionId: 'v2:session-test-newcomer' }
  for (const name of ['self', ' Self ', 'SELF', 'host', ' Host ']) {
    await expect(t.mutation(api.bills.guest.people.joinSplit, { ...newcomer, name })).rejects.toThrow('reserved for the host')
    // Nor rename an existing guest to it.
    await expect(t.mutation(api.bills.guest.people.joinSplit, { ...guest, name })).rejects.toThrow('reserved for the host')
    await expect(t.mutation(api.bills.guest.people.addGuestPerson, { ...guest, name })).rejects.toThrow('reserved for the host')
  }
  const after = (await t.query(api.bills.host.queries.getBill, host)).people
  expect(after).toEqual(before)
  expect(after.find((p) => p.id === john)?.name).toBe('John')
  // Names merely containing the word are fine.
  await t.mutation(api.bills.guest.people.addGuestPerson, { ...guest, name: 'Selfie' })
})

test('on a freshly created bill the host’s seeded person is step-protected from guests but shareable', async () => {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  const { billId, hostToken } = await t.mutation(api.bills.host.lifecycle.createBill, {
    deviceId: 'session-test-device', merchantName: 'Seeded host',
  })
  const host = { id: billId, hostToken }
  const initial = await t.query(api.bills.host.queries.getBill, host)
  await t.mutation(api.bills.host.lifecycle.saveWorking, {
    ...host, baseVersion: initial.version,
    lineItems: [{ id: 'meal', name: 'Meal', qty: 2, unitPrice: 90000, lineTotal: 180000 }],
  })
  const shareToken = await t.mutation(api.bills.host.lifecycle.publish, host)
  const guest = { shareToken, guestSessionId: 'v2:session-test-seeded' }
  const { personId: john } = await t.mutation(api.bills.guest.people.joinSplit, { ...guest, name: 'John' })
  const hostPerson = initial.people[0].id
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: hostPerson, itemId: 'meal', delta: 1 })).rejects.toThrow('Only the host')
  const split = await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: [hostPerson, john], quantity: 2 })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(expect.arrayContaining([
    { itemId: 'meal', personId: hostPerson, units: 1 },
    { itemId: 'meal', personId: john, units: 1 },
  ]))
  await t.mutation(api.bills.guest.claims.restoreGuestItemSplit, { ...guest, itemId: 'meal', ...split })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual([])
})

// --- The host marker (`isHost`) and renameHostPerson -----------------------

async function storedPeople(t: Awaited<ReturnType<typeof session>>['t'], id: Awaited<ReturnType<typeof session>>['host']['id']) {
  return (await t.run((ctx) => ctx.db.get(id)))!.people
}

test('createBill and createDemoBill seed the host’s person with isHost', async () => {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  for (const created of [
    await t.mutation(api.bills.host.lifecycle.createBill, { deviceId: 'marker-device' }),
    await t.mutation(api.bills.host.lifecycle.createDemoBill, { deviceId: 'marker-device' }),
  ]) {
    const people = await storedPeople(t, created.billId)
    expect(people).toEqual([expect.objectContaining({ name: 'self', isHost: true })])
    // Not a secret: the marker is on the wire.
    const bill = await t.query(api.bills.host.queries.getBill, { id: created.billId, hostToken: created.hostToken })
    expect(bill.people[0].isHost).toBe(true)
  }
})

test('people added by the host or by guests never carry isHost', async () => {
  const { t, host, guest, john, hostPerson } = await session()
  await t.mutation(api.bills.host.people.addHostPerson, { ...host, name: 'Friend' })
  await t.mutation(api.bills.guest.people.addGuestPerson, { ...guest, name: 'Companion' })
  const people = await storedPeople(t, host.id)
  expect(people.filter((p) => p.isHost).map((p) => p.id)).toEqual([hostPerson])
  expect(people.find((p) => p.id === john)?.isHost).toBeUndefined()
})

test('saveWorking cannot clear, move or forge isHost, nor revert the host’s name', async () => {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  const { billId, hostToken } = await t.mutation(api.bills.host.lifecycle.createBill, { deviceId: 'marker-device' })
  const host = { id: billId, hostToken }
  const initial = await t.query(api.bills.host.queries.getBill, host)
  const hostPerson = initial.people[0].id
  await t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId: hostPerson, name: 'Charbel' })
  const current = await t.query(api.bills.host.queries.getBill, host)
  await t.mutation(api.bills.host.lifecycle.saveWorking, {
    ...host,
    baseVersion: current.version,
    people: [
      // Stale editor copy: old name, marker cleared.
      { id: hostPerson, name: 'self', color: 'red', isHost: false },
      // A new person claiming to be the host.
      { id: 'forged', name: 'self', color: 'blue', isHost: true },
    ],
  })
  const people = await storedPeople(t, billId)
  expect(people.find((p) => p.id === hostPerson)).toMatchObject({ name: 'Charbel', isHost: true })
  expect(people.find((p) => p.id === 'forged')).not.toHaveProperty('isHost')
  // Reordering doesn't move it either.
  const again = await t.query(api.bills.host.queries.getBill, host)
  await t.mutation(api.bills.host.lifecycle.saveWorking, {
    ...host, baseVersion: again.version, people: [...again.people].reverse(),
  })
  expect((await storedPeople(t, billId)).filter((p) => p.isHost).map((p) => p.id)).toEqual([hostPerson])
})

test('after a rename the host’s person stays step-protected from guests, and shareable', async () => {
  const { t, host, guest, john, hostPerson } = await session()
  await t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId: hostPerson, name: 'Charbel' })
  // A guest may pick the host's real name; it doesn't make them the host.
  const { personId: namesake } = await t.mutation(api.bills.guest.people.addGuestPerson, { ...guest, name: 'Charbel' })
  const guestBill = await t.query(api.bills.guest.queries.getBillByToken, { shareToken: guest.shareToken })
  expect(guestBill.people.find((p) => p.id === hostPerson)).toMatchObject({ name: 'Charbel', isHost: true })
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: hostPerson, itemId: 'meal', delta: 1 })).rejects.toThrow('Only the host')
  await expect(t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: [hostPerson], quantity: 1 })).rejects.toThrow('Only the host')
  await t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: namesake, itemId: 'meal', delta: 1 })
  await t.mutation(api.bills.guest.claims.shareGuestItemEvenly, { ...guest, itemId: 'meal', personIds: [hostPerson, john], quantity: 2 })
  expect((await t.query(api.bills.host.queries.getBill, host)).claims).toEqual(expect.arrayContaining([
    { itemId: 'meal', personId: namesake, units: 1 },
    { itemId: 'meal', personId: hostPerson, units: 1 },
    { itemId: 'meal', personId: john, units: 1 },
  ]))
})

test('a legacy bill without isHost still protects the "self" person, and a rename pins the marker', async () => {
  const { t, host, guest, hostPerson } = await session()
  await t.run(async (ctx) => {
    const bill = (await ctx.db.get(host.id))!
    await ctx.db.patch(host.id, { people: bill.people.map(({ isHost: _marker, ...p }) => p) })
  })
  expect((await storedPeople(t, host.id)).some((p) => p.isHost)).toBe(false)
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: hostPerson, itemId: 'meal', delta: 1 })).rejects.toThrow('Only the host')
  await t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId: hostPerson, name: 'Charbel' })
  expect((await storedPeople(t, host.id)).find((p) => p.id === hostPerson)).toMatchObject({ name: 'Charbel', isHost: true })
  await expect(t.mutation(api.bills.guest.claims.stepGuestClaim, { ...guest, personId: hostPerson, itemId: 'meal', delta: 1 })).rejects.toThrow('Only the host')
})

test('renameHostPerson renames only the host’s own person, bumps the version and caps the length', async () => {
  const { t, host, john, hostPerson } = await session()
  const before = await t.query(api.bills.host.queries.getBill, host)
  await t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId: hostPerson, name: `  ${'x'.repeat(200)}  ` })
  const after = await t.query(api.bills.host.queries.getBill, host)
  expect(after.version).toBe(before.version + 1)
  const renamed = after.people.find((p) => p.id === hostPerson)!.name
  expect(renamed.length).toBeLessThan(200)
  expect(renamed).toMatch(/^x+$/)

  const friend = await t.mutation(api.bills.host.people.addHostPerson, { ...host, name: 'Friend' })
  for (const personId of [john, friend.personId, 'missing']) {
    await expect(t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId, name: 'Charbel' })).rejects.toThrow()
  }
  for (const name of ['', '   ']) {
    await expect(t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId: hostPerson, name })).rejects.toThrow('Name is required')
  }
  await expect(t.mutation(api.bills.host.people.renameHostPerson, { ...host, hostToken: 'wrong-token', personId: hostPerson, name: 'Mallory' })).rejects.toThrow('edit access')
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await expect(t.mutation(api.bills.host.people.renameHostPerson, { ...host, personId: hostPerson, name: 'Late' })).rejects.toThrow('finalized')
  const final = await storedPeople(t, host.id)
  expect(final.find((p) => p.id === hostPerson)?.name).toBe(renamed)
  expect(final.find((p) => p.id === john)?.name).toBe('John')
})
