import { expect, test, vi, afterEach } from 'vitest'
import { rememberHostToken } from './hostToken'
import { getOrCreateGuestSessionId } from './guestSession'
afterEach(() => vi.unstubAllGlobals())
function blockedStorage() {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage blocked')
      },
    },
  })
}
test('host storage failure is reported to the creation flow', () => {
  blockedStorage()
  expect(() => rememberHostToken('bill', 'secret')).toThrow()
})
test('guest storage failure does not crash mounting', () => {
  blockedStorage()
  expect(() => getOrCreateGuestSessionId('share')).not.toThrow()
})

test('stored host access can be read, and cleared site data removes it', async () => {
  const { getHostToken } = await import('./hostToken')
  const data = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  })
  rememberHostToken('bill', 'host-token')
  expect(getHostToken('bill')).toBe('host-token')
  data.clear()
  expect(getHostToken('bill')).toBe('')
})

test('new guest credentials ignore legacy storage and remain stable for the invitation', () => {
  const data = new Map([['bill-guest:share', 'exposed-legacy-secret']])
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  })
  const session = getOrCreateGuestSessionId('share')
  expect(session).toMatch(/^v2:/)
  expect(session).not.toContain('exposed-legacy-secret')
  expect(getOrCreateGuestSessionId('share')).toBe(session)
  expect(getOrCreateGuestSessionId('different-share')).not.toBe(session)
})
