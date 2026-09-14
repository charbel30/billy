import { convexTest } from 'convex-test'
import rateLimiter from '@convex-dev/rate-limiter/test'
import actionRetrier from '@convex-dev/action-retrier/test'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from 'convex/_generated/api'
import { modules, schema } from './setup'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

async function setup() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  actionRetrier.register(t)
  const { billId, hostToken } = await t.mutation(api.bills.host.lifecycle.createBill, { deviceId: 'upload-test-device' })
  const imageRef = await t.run((ctx) => ctx.storage.store(new Blob(['test receipt'], { type: 'image/png' })))
  return { t, host: { id: billId, hostToken }, imageRef, deviceId: 'upload-test-device' }
}

test('upload URL generation uses the rate limiter and respects the scanner pause', async () => {
  const { t, deviceId } = await setup()
  expect(await t.mutation(api.bills.host.uploads.generateUploadUrl, { deviceId })).toMatch(/^https?:/)
  vi.stubEnv('EXTRACTION_DISABLED', '1')
  await expect(t.mutation(api.bills.host.uploads.generateUploadUrl, { deviceId })).rejects.toThrow('temporarily paused')
  // Manual entry remains available when scanning is paused.
  await expect(t.mutation(api.bills.host.lifecycle.createBill, { deviceId })).resolves.toHaveProperty('billId')
})

test('a rejected public attach action cleans up an unreferenced upload', async () => {
  const { t, host, imageRef, deviceId } = await setup()
  await expect(t.action(api.bills.host.uploads.attachImageAndExtract, {
    ...host, hostToken: 'invalid-test-capability', imageRef, deviceId,
  })).rejects.toThrow()
  expect(await t.run((ctx) => ctx.storage.get(imageRef))).toBeNull()
})

test('rejected attachment cannot delete an image already owned by a bill', async () => {
  const { t, host, imageRef, deviceId } = await setup()
  await t.run((ctx) => ctx.db.patch(host.id, { imageRef }))
  await expect(t.action(api.bills.host.uploads.attachImageAndExtract, {
    ...host, hostToken: 'invalid-test-capability', imageRef, deviceId,
  })).rejects.toThrow()
  expect(await t.run(async (ctx) => (await ctx.storage.get(imageRef)) !== null)).toBe(true)
})

test('abandoning extraction detaches and deletes the image while preserving manual entry', async () => {
  const { t, host, imageRef } = await setup()
  await t.run((ctx) => ctx.db.patch(host.id, { imageRef, extractionBaseVersion: 0 }))
  await t.mutation(api.bills.host.uploads.abandonExtraction, host)
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.imageRef).toBeUndefined()
  expect(bill.version).toBe(0)
  expect(await t.run((ctx) => ctx.storage.get(imageRef))).toBeNull()
})

test('attach schedules the real retrier, applies a provider result and deletes the receipt', async () => {
  vi.useFakeTimers()
  const { t, host, imageRef, deviceId } = await setup()
  vi.stubEnv('CF_AIG_ACCOUNT_ID', 'test-account')
  vi.stubEnv('CF_AIG_GATEWAY', 'test-gateway')
  vi.stubEnv('GEMINI_API_KEY', 'test-only-key')
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      merchant: 'Scanned shop', branch: null, datetime: null,
      currency_primary: 'LBP',
      line_items: [{ name: 'Meal', qty: 1, unit_price: 90000, line_total: 90000 }],
      service_charge: 0, tax: 0, printed_total_lbp: 90000, printed_total_usd: 1,
    }) }] } }],
  }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  await t.action(api.bills.host.uploads.attachImageAndExtract, { ...host, imageRef, deviceId })
  const scheduled = await t.run((ctx) => ctx.db.get(host.id))
  expect(scheduled?.extractionRunId).toBeDefined()
  // Duplicate attachment must not create a second paid extraction run.
  await t.action(api.bills.host.uploads.attachImageAndExtract, { ...host, imageRef, deviceId })
  expect((await t.run((ctx) => ctx.db.get(host.id)))?.extractionRunId).toBe(scheduled?.extractionRunId)
  await t.finishAllScheduledFunctions(() => vi.runAllTimers())
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.merchantName).toBe('Scanned shop')
  expect(bill.lineItems[0].lineTotal).toBe(90000)
  expect(bill.imageRef).toBeUndefined()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(await t.run((ctx) => ctx.storage.get(imageRef))).toBeNull()
})

test('provider failures exhaust retries, expose a safe error and delete the receipt', async () => {
  vi.useFakeTimers()
  const { t, host, imageRef, deviceId } = await setup()
  vi.stubEnv('CF_AIG_ACCOUNT_ID', 'test-account')
  vi.stubEnv('CF_AIG_GATEWAY', 'test-gateway')
  vi.stubEnv('GEMINI_API_KEY', 'test-only-key')
  const fetchMock = vi.fn(async () => new Response('provider-private-details', { status: 503 }))
  vi.stubGlobal('fetch', fetchMock)
  await t.action(api.bills.host.uploads.attachImageAndExtract, { ...host, imageRef, deviceId })
  await t.finishAllScheduledFunctions(() => vi.runAllTimers())
  const bill = await t.query(api.bills.host.queries.getBill, host)
  expect(bill.status).toBe('NEEDS_REVIEW')
  expect(bill.extractionError).toBeTruthy()
  expect(bill.extractionError).not.toContain('provider-private-details')
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(await t.run((ctx) => ctx.storage.get(imageRef))).toBeNull()
})
