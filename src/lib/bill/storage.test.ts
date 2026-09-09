import { expect, test, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import {
  clearWorkingBill,
  persistWorkingBill,
  readWorkingBill,
} from './storage'
import type { WorkingBill } from './types'

test('an old acknowledgement cannot delete a newer recovery draft', () => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  const id = 'bill' as Id<'bills'>
  const old: WorkingBill = {
    version: 1,
    status: 'READY',
    lineItems: [],
    people: [],
    meta: {
      merchantName: 'Old',
      currencyPrimary: 'LBP',
      rate: 90000,
      rateSource: 'manual',
      serviceCharge: 0,
      tax: 0,
      serviceChargeOn: false,
      serviceSplitMode: 'proportional',
    },
  }
  const newer = { ...old, meta: { ...old.meta, merchantName: 'New' } }
  persistWorkingBill(id, newer)
  Reflect.apply(clearWorkingBill, undefined, [id, old])
  expect(readWorkingBill(id)?.meta.merchantName).toBe('New')
  vi.unstubAllGlobals()
})
