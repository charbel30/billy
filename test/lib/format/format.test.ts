import { expect, test } from 'vitest'
import { formatUnits } from '~/lib/format/format'

test('shared units show exact familiar fractions and mixed quantities', () => {
  expect(formatUnits(1 / 3)).toBe('⅓')
  expect(formatUnits(2 / 3)).toBe('⅔')
  expect(formatUnits(4 / 3)).toBe('1⅓')
  expect(formatUnits(0.5)).toBe('½')
  expect(formatUnits(2)).toBe('2')
  expect(formatUnits(1 / 7)).toBe('1/7')
  expect(formatUnits(0.37)).toBe('0.37')
})
