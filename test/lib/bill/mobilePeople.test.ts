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
  // A joined guest can pick items for anyone at the table, not only their own.
  expect(html).toContain('Pick items for Host')
  expect(html).toContain('Pick items for John')
  expect(html).toContain('Pick items for Jane')
  expect(html).not.toContain('View total for')
  // Own people still sort first after self: John (self), then Host, Jane.
  expect(html.indexOf('Pick items for John')).toBeLessThan(html.indexOf('Pick items for Host'))
  expect(html).not.toContain('disabled')
})
