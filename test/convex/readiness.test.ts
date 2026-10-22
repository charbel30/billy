import { convexTest } from 'convex-test'
import rateLimiter from '@convex-dev/rate-limiter/test'
import { expect, test } from 'vitest'
import { api, internal } from 'convex/_generated/api'
import { modules, schema } from './setup'

async function setup() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  const id = await t.run((ctx) =>
    ctx.db.insert('bills', {
      merchantName: 'Test',
      currencyPrimary: 'LBP',
      rate: 90000,
      rateSource: 'manual',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
      shareToken: 'share-secret',
      hostToken: 'host-secret',
      status: 'PUBLISHED',
      version: 1,
      updatedAt: 1,
      lineItems: [
        {
          id: 'meal',
          name: 'Meal',
          qty: 1,
          unitPrice: 90000,
          lineTotal: 90000,
        },
      ],
      people: [
        {
          id: 'alice',
          name: 'Alice',
          color: 'red',
          guestSessionId: 'alice-secret',
        },
      ],
    }),
  )
  return { t, id, host: { id, hostToken: 'host-secret' } }
}

test('public bill responses never disclose guest edit credentials', async () => {
  const { t } = await setup()
  const bill = await t.query(api.bills.guest.queries.getBillByToken, {
    shareToken: 'share-secret',
  })
  expect(JSON.stringify(bill)).not.toContain('alice-secret')
})

test('a learned bill id cannot bypass share revocation', async () => {
  const { t, id, host } = await setup()
  await t.mutation(api.bills.host.lifecycle.revokeShare, host)
  await expect(
    t.query(api.bills.host.queries.getBill, { id, hostToken: '' }),
  ).rejects.toThrow()
})

test('late extraction cannot replace finalized items', async () => {
  const { t, id, host } = await setup()
  await t.run((ctx) => ctx.db.patch(id, { imageRef: 'old-image' }))
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await t.mutation(internal.bills.extraction.applyExtraction, {
    billId: id,
    imageRef: 'old-image',
    parsed: {
      currency_primary: 'LBP',
      line_items: [{ name: 'Wrong', qty: 1, unit_price: 1, line_total: 1 }],
      service_charge: 0,
      tax: 0,
    },
  })
  const bill = await t.run((ctx) => ctx.db.get(id))
  expect(bill?.status).toBe('FINALIZED')
  expect(bill?.lineItems[0].name).toBe('Meal')
})

test('invalid monetary metadata is rejected', async () => {
  const { t, host } = await setup()
  await expect(
    t.mutation(api.bills.host.lifecycle.saveWorking, {
      ...host,
      baseVersion: 1,
      meta: { rate: -1, tax: -100 },
    }),
  ).rejects.toThrow()
})

const aliceSession = 'v2:alice-session-secret'
const bobSession = 'v2:bob-session-secret'
async function currentGuests() {
  const fixture = await setup()
  await fixture.t.run((ctx) =>
    ctx.db.patch(fixture.id, {
      people: [
        {
          id: 'alice',
          name: 'Alice',
          color: 'red',
          guestSessionId: aliceSession,
          guestAccessVersion: 2,
        },
        {
          id: 'companion',
          name: 'Companion',
          color: 'green',
          guestSessionId: aliceSession,
          guestAccessVersion: 2,
        },
        {
          id: 'bob',
          name: 'Bob',
          color: 'blue',
          guestSessionId: bobSession,
          guestAccessVersion: 2,
        },
      ],
    }),
  )
  return fixture
}

test('public JSON and host JSON have no guest secrets; ownership is caller-scoped', async () => {
  const { t, host } = await currentGuests()
  for (const bill of [
    await t.query(api.bills.host.queries.getBill, host),
    await t.query(api.bills.guest.queries.getBillByToken, {
      shareToken: 'share-secret',
    }),
  ]) {
    expect(JSON.stringify(bill)).not.toMatch(
      /guestSessionId|guestAccessVersion|v2:alice|v2:bob|host-secret/,
    )
  }
  expect(
    await t.query(api.bills.guest.queries.getControlledPeople, {
      shareToken: 'share-secret',
      guestSessionId: aliceSession,
    }),
  ).toEqual(['alice', 'companion'])
  expect(
    await t.query(api.bills.guest.queries.getControlledPeople, {
      shareToken: 'share-secret',
      guestSessionId: bobSession,
    }),
  ).toEqual(['bob'])
  await expect(
    t.mutation(api.bills.guest.people.setGuestPersonPaid, {
      shareToken: 'share-secret',
      guestSessionId: aliceSession,
      personId: 'bob',
      paid: true,
    }),
  ).rejects.toThrow()
  await t.mutation(api.bills.guest.people.joinSplit, {
    shareToken: 'share-secret',
    guestSessionId: aliceSession,
    name: 'Alice renamed',
  })
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.people.find((p) => p.id === 'bob')?.name).toBe('Bob')
})

test('legacy credentials are invalidated even if their value resembles a new session', async () => {
  const { t, id } = await setup()
  await t.run((ctx) =>
    ctx.db.patch(id, {
      people: [
        {
          id: 'alice',
          name: 'Alice',
          color: 'red',
          guestSessionId: aliceSession,
        },
      ],
    }),
  )
  expect(
    await t.query(api.bills.guest.queries.getControlledPeople, {
      shareToken: 'share-secret',
      guestSessionId: aliceSession,
    }),
  ).toEqual([])
  await expect(
    t.mutation(api.bills.guest.claims.stepGuestClaim, {
      shareToken: 'share-secret',
      guestSessionId: aliceSession,
      personId: 'alice',
      itemId: 'meal',
      delta: 1,
    }),
  ).rejects.toThrow()
})

test('revocation blocks every old guest path and republishing permits only the new link', async () => {
  const { t, host } = await currentGuests()
  await t.mutation(api.bills.host.lifecycle.revokeShare, host)
  await expect(
    t.query(api.bills.guest.queries.getBillByToken, {
      shareToken: 'share-secret',
    }),
  ).rejects.toThrow()
  await expect(
    t.query(api.bills.guest.queries.getControlledPeople, {
      shareToken: 'share-secret',
      guestSessionId: aliceSession,
    }),
  ).rejects.toThrow()
  const replacement = (await t.query(api.bills.host.queries.getBill, host))
    .shareToken
  await expect(
    t.query(api.bills.guest.queries.getBillByToken, {
      shareToken: replacement,
    }),
  ).rejects.toThrow()
  await t.mutation(api.bills.host.lifecycle.publish, host)
  expect(
    (
      await t.query(api.bills.guest.queries.getBillByToken, {
        shareToken: replacement,
      })
    ).merchantName,
  ).toBe('Test')
  await expect(
    t.query(api.bills.guest.queries.getBillByToken, {
      shareToken: 'share-secret',
    }),
  ).rejects.toThrow()
})

test('host editor saves preserve private ownership metadata', async () => {
  const { t, id, host } = await currentGuests()
  await t.mutation(api.bills.host.lifecycle.revokeShare, host)
  const publicBill = await t.query(api.bills.host.queries.getBill, host)
  await t.mutation(api.bills.host.lifecycle.saveWorking, {
    ...host,
    baseVersion: publicBill.version,
    people: publicBill.people,
  })
  const stored = await t.run((ctx) => ctx.db.get(id))
  expect(stored?.people.find((p) => p.id === 'alice')).toMatchObject({
    guestSessionId: aliceSession,
    guestAccessVersion: 2,
  })
})

for (const meta of [
  { rate: 0 },
  { rate: -1 },
  { rate: Infinity },
  { rate: NaN },
  { rate: 1e30 },
  { tax: -1 },
  { serviceCharge: Infinity },
  { printedTotalUsd: -1 },
  { currencyPrimary: 'USD' },
]) {
  test(`rejects invalid metadata ${JSON.stringify(meta)}`, async () => {
    const { t, host } = await setup()
    await expect(
      t.mutation(api.bills.host.lifecycle.saveWorking, {
        ...host,
        baseVersion: 1,
        meta,
      }),
    ).rejects.toThrow()
  })
}

test('stale and finalized editor writes fail instead of acknowledging discarded work', async () => {
  const { t, host } = await setup()
  expect(
    await t.mutation(api.bills.host.lifecycle.saveWorking, {
      ...host,
      baseVersion: 1,
      meta: { merchantName: 'First' },
    }),
  ).toEqual({ version: 2 })
  await expect(
    t.mutation(api.bills.host.lifecycle.saveWorking, {
      ...host,
      baseVersion: 1,
      meta: { merchantName: 'Stale' },
    }),
  ).rejects.toThrow()
  await t.mutation(api.bills.host.lifecycle.finalize, host)
  await expect(
    t.mutation(api.bills.host.lifecycle.saveWorking, {
      ...host,
      baseVersion: 2,
      meta: { merchantName: 'Late' },
    }),
  ).rejects.toThrow()
})

const receipt = {
  currency_primary: 'LBP',
  line_items: [
    { name: 'Scanned', qty: 1, unit_price: 90000, line_total: 90000 },
  ],
  service_charge: 0,
  tax: 0,
}
for (const scenario of [
  'edited',
  'published',
  'replaced',
  'invalid',
  'valid',
] as const) {
  test(`extraction completion handles ${scenario} state`, async () => {
    const { t, id } = await setup()
    await t.run((ctx) =>
      ctx.db.patch(id, {
        status: 'PENDING',
        imageRef: 'scan-image',
        extractionBaseVersion: 1,
      }),
    )
    if (scenario === 'edited')
      await t.run((ctx) =>
        ctx.db.patch(id, { version: 2, merchantName: 'Manual edit' }),
      )
    if (scenario === 'published')
      await t.run((ctx) => ctx.db.patch(id, { status: 'PUBLISHED' }))
    if (scenario === 'replaced')
      await t.run((ctx) => ctx.db.patch(id, { imageRef: 'new-image' }))
    await t.mutation(internal.bills.extraction.applyExtraction, {
      billId: id,
      imageRef: 'scan-image',
      parsed: scenario === 'invalid' ? { ...receipt, tax: -1 } : receipt,
    })
    const bill = await t.run((ctx) => ctx.db.get(id))
    expect(bill?.lineItems[0].name).toBe(
      scenario === 'valid' ? 'Scanned' : 'Meal',
    )
    expect(bill?.imageRef).toBe(
      scenario === 'replaced' ? 'new-image' : undefined,
    )
    if (scenario === 'invalid') expect(bill?.extractionError).toBeTruthy()
    if (scenario === 'edited') expect(bill?.merchantName).toBe('Manual edit')
  })
}

import type { RunId } from '@convex-dev/action-retrier'
for (const status of ['PUBLISHED', 'FINALIZED'] as const) {
  test(`rescan scheduling rejects ${status} before starting extraction`, async () => {
    const { t, id, host } = await setup()
    const imageRef = await t.run(async (ctx) => {
      await ctx.db.patch(id, { status })
      return ctx.storage.store(new Blob(['image'], { type: 'image/png' }))
    })
    await expect(
      t.mutation(internal.bills.host.uploads.prepareImageExtraction, {
        ...host,
        deviceId: 'test-device',
        imageRef,
      }),
    ).rejects.toThrow()
    expect(
      (await t.run((ctx) => ctx.db.get(id)))?.extractionRunId,
    ).toBeUndefined()
  })
}

for (const edited of [false, true]) {
  test(`failed extraction cleans up its image and ${edited ? 'preserves newer edits' : 'reports failure'}`, async () => {
    const { t, id } = await setup()
    const runId = 'synthetic-extraction-run' as RunId
    const imageRef = await t.run(async (ctx) => {
      const imageRef = await ctx.storage.store(new Blob(['image']))
      await ctx.db.patch(id, {
        status: edited ? 'FINALIZED' : 'PENDING',
        lineItems: [],
        imageRef,
        extractionRunId: runId,
        extractionBaseVersion: 1,
        version: edited ? 2 : 1,
      })
      return imageRef
    })
    await t.mutation(internal.bills.extraction.onExtractionComplete, {
      runId,
      result: { type: 'failed', error: 'synthetic failure' },
    })
    const bill = await t.run((ctx) => ctx.db.get(id))
    expect(bill?.status).toBe(edited ? 'FINALIZED' : 'NEEDS_REVIEW')
    expect(Boolean(bill?.extractionError)).toBe(!edited)
    expect(bill?.imageRef).toBeUndefined()
    expect(await t.run((ctx) => ctx.storage.get(imageRef))).toBeNull()
  })
}

test('invalid preexisting bills cannot be published or finalized', async () => {
  const { t, id, host } = await setup()
  await t.run((ctx) => ctx.db.patch(id, { rate: 0, status: 'READY' }))
  await expect(
    t.mutation(api.bills.host.lifecycle.publish, host),
  ).rejects.toThrow()
  await expect(
    t.mutation(api.bills.host.lifecycle.finalize, host),
  ).rejects.toThrow()
})
