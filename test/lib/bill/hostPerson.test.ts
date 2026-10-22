import { expect, test } from 'vitest'
import {
  hostDisplayName,
  hostPersonId,
  isReservedGuestName,
  withHostLabel,
} from '~/lib/bill'
import { joinCopy } from '~/components/features/join/content'
import { splitCopy } from '~/components/features/split/content'

test('the marked person is the host, whatever it is named', () => {
  expect(hostPersonId([
    { id: 'j', name: 'John' },
    { id: 'h', name: 'Charbel', isHost: true },
    { id: 's', name: 'self' },
  ])).toBe('h')
})

test('legacy bills without a marker fall back to the seed name', () => {
  expect(hostPersonId([
    { id: 'j', name: 'John' },
    { id: 'h', name: 'self' },
  ])).toBe('h')
  expect(hostPersonId([{ id: 'j', name: 'John' }])).toBeUndefined()
  // Name match is exact: 'Self' is not the seed.
  expect(hostPersonId([{ id: 's', name: 'Self' }])).toBeUndefined()
})

test('a row carrying a guest session never counts as the host', () => {
  expect(hostPersonId([{ id: 'g', name: 'self', guestSessionId: 'v2:x' }])).toBeUndefined()
  // Once any marker exists, the name fallback is off.
  expect(hostPersonId([
    { id: 'g', name: 'Mallory', isHost: true, guestSessionId: 'v2:x' },
    { id: 's', name: 'self' },
  ])).toBeUndefined()
})

test('host view: the seed reads "You", a renamed host "<name> (you)"', () => {
  expect(hostDisplayName('self', splitCopy.hostLabels)).toBe('You')
  expect(hostDisplayName('Charbel', splitCopy.hostLabels)).toBe('Charbel (you)')
})

test('guest view: the seed reads "Host", a renamed host "<name> (host)"', () => {
  expect(hostDisplayName('self', joinCopy.hostLabels)).toBe(joinCopy.hostName)
  expect(hostDisplayName('Charbel', joinCopy.hostLabels)).toBe('Charbel (host)')
})

test('withHostLabel relabels only the host’s person and leaves everyone else alone', () => {
  const people = [
    { id: 'h', name: 'Charbel', color: 'red', isHost: true },
    { id: 'j', name: 'John', color: 'blue' },
    // A guest who picked the host's real name stays distinguishable.
    { id: 'c', name: 'Charbel', color: 'green' },
  ]
  const shown = withHostLabel(people, hostPersonId(people), joinCopy.hostLabels)
  expect(shown.map((p) => p.name)).toEqual(['Charbel (host)', 'John', 'Charbel'])
  expect(shown[0]).toMatchObject({ id: 'h', color: 'red', isHost: true })
  expect(shown[1]).toBe(people[1])
  expect(people[0].name).toBe('Charbel') // input untouched
  expect(withHostLabel(people, undefined, joinCopy.hostLabels)).toEqual(people)
})

test('reserved guest names are matched trimmed and case-insensitively', () => {
  for (const name of ['self', ' Self ', 'HOST', 'host']) expect(isReservedGuestName(name)).toBe(true)
  for (const name of ['Selfie', 'Hostess', 'John', 'Charbel', '']) expect(isReservedGuestName(name)).toBe(false)
})
