import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { MobilePersonPicker } from '~/components/features/bill/people/MobilePersonPicker'

test('a mobile guest sees the host and other guests as well as their own people', () => {
  const html = renderToStaticMarkup(createElement(MobilePersonPicker, {
    people: [
      { id: 'host', name: 'Host', color: '#ef4444' },
      { id: 'john', name: 'John', color: '#f59e0b' },
      { id: 'jane', name: 'Jane', color: '#22c55e' },
    ],
    activeId: 'john',
    selfId: 'john',
    ownIds: new Set(['john']),
    onSelect: () => {},
    portfolioByPerson: new Map(),
    lineItems: [],
    claims: [],
    serviceChargeOn: false,
  }))
  expect(html).toContain('Host')
  expect(html).toContain('John')
  expect(html).toContain('Jane')
  expect(html).toContain('3 people')
  expect(html).toContain('View total for Host')
  expect(html).toContain('Pick items for John')
})
