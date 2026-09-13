import { expect, test } from 'vitest'
import {
  computePortfolios,
  unallocatedAmounts,
  type ComputePortfoliosInput,
} from '~/lib/money/split'

test('proportional service with no claims remains unallocated', () => {
  const portfolios = computePortfolios({
    lineItems: [],
    claims: [],
    people: [{ id: 'a', name: 'A', color: 'red' }],
    serviceCharge: 90000,
    tax: 0,
    serviceChargeOn: true,
    serviceSplitMode: 'proportional',
    rate: 90000,
  })
  expect(portfolios[0].totalLbp).toBe(0)
})

const people = ['a', 'b', 'c'].map((id) => ({ id, name: id, color: 'red' }))
const base: ComputePortfoliosInput = {
  lineItems: [
    { id: 'meal', name: 'Meal', qty: 3, unitPrice: 90000, lineTotal: 270000 },
  ],
  people,
  claims: [],
  serviceCharge: 90000,
  tax: 0,
  serviceChargeOn: true,
  serviceSplitMode: 'proportional',
  rate: 90000,
}

test('no claims, no people, and zero-price claims leave proportional extras unallocated', () => {
  for (const input of [
    base,
    { ...base, people: [] },
    {
      ...base,
      lineItems: [{ ...base.lineItems[0], unitPrice: 0, lineTotal: 0 }],
      claims: [{ itemId: 'meal', personId: 'a', units: 1 }],
    },
  ]) {
    expect(
      computePortfolios(input).reduce((sum, p) => sum + p.totalLbp, 0),
    ).toBe(0)
    expect(unallocatedAmounts(input).serviceLbp).toBe(90000)
  }
})

test('even service is payable per head even without item claims', () => {
  const input = { ...base, serviceSplitMode: 'even' as const }
  expect(computePortfolios(input).map((p) => p.totalLbp)).toEqual([
    30000, 30000, 30000,
  ])
  expect(unallocatedAmounts(input)).toEqual({
    itemsLbp: 270000,
    serviceLbp: 0,
    totalLbp: 270000,
  })
})

test('partial claims allocate all proportional service and tip only the claimed subtotal', () => {
  const input = {
    ...base,
    tipPercent: 10,
    claims: [{ itemId: 'meal', personId: 'a', units: 1 }],
  }
  expect(computePortfolios(input).map((p) => p.totalLbp)).toEqual([
    189000, 0, 0,
  ])
  expect(unallocatedAmounts(input)).toEqual({
    itemsLbp: 180000,
    serviceLbp: 0,
    totalLbp: 180000,
  })
})

test('fractional claims reconcile components without manufacturing negative service', () => {
  const input = {
    ...base,
    lineItems: [{ ...base.lineItems[0], qty: 1, unitPrice: 2, lineTotal: 2 }],
    claims: people.map((p) => ({
      itemId: 'meal',
      personId: p.id,
      units: 1 / 3,
    })),
    serviceChargeOn: false,
  }
  const portfolios = computePortfolios(input)
  expect(portfolios.map((p) => p.totalLbp)).toEqual([1, 1, 0])
  expect(portfolios.map((p) => p.serviceShareLbp)).toEqual([0, 0, 0])
})

test('one dollar split three ways pays exactly 100 cents', () => {
  const input = {
    ...base,
    lineItems: [
      { ...base.lineItems[0], qty: 1, unitPrice: 90000, lineTotal: 90000 },
    ],
    claims: people.map((p) => ({
      itemId: 'meal',
      personId: p.id,
      units: 1 / 3,
    })),
    serviceChargeOn: false,
  }
  expect(computePortfolios(input).map((p) => p.totalUsd)).toEqual([
    0.34, 0.33, 0.33,
  ])
})

test('ordinary service, tax and tip reconcile both currency totals', () => {
  const input = {
    ...base,
    tax: 45000,
    tipPercent: 10,
    claims: people.map((p) => ({ itemId: 'meal', personId: p.id, units: 1 })),
  }
  const portfolios = computePortfolios(input)
  expect(portfolios.map((p) => p.totalLbp)).toEqual([144000, 144000, 144000])
  expect(portfolios.map((p) => p.totalUsd)).toEqual([1.6, 1.6, 1.6])
  expect(unallocatedAmounts(input).totalLbp).toBe(0)
})
