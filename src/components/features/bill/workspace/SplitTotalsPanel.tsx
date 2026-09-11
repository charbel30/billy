import type { ReactNode } from 'react'
import { Accordion } from '@base-ui/react/accordion'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { formatLbp, formatUsd, toUsd } from '~/lib/money'
import { SplitTotalsPersonRow } from './SplitTotalsPersonRow'

/**
 * Expanded panel of the split/join dock (and the desktop totals column): the
 * whole table's assigned/unclaimed totals plus a breakdown per person.
 */
export function SplitTotalsPanel({
  breakdownPeople,
  selfId,
  ownIds,
  portfolioByPerson,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
  grandLbp,
  remainingLbp = 0,
  extra,
}: {
  breakdownPeople: Person[]
  selfId?: string
  /** Ids the viewer controls — those breakdowns sort first. */
  ownIds?: ReadonlySet<string>
  portfolioByPerson: Map<string, Portfolio>
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
  grandLbp: number
  remainingLbp?: number
  /** Trailing content (the host's tip control). */
  extra?: ReactNode
}) {
  const ordered = [
    ...breakdownPeople.filter((person) => person.id === selfId),
    ...breakdownPeople.filter(
      (person) => person.id !== selfId && (!ownIds || ownIds.has(person.id)),
    ),
    ...breakdownPeople.filter(
      (person) => person.id !== selfId && ownIds && !ownIds.has(person.id),
    ),
  ]

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 px-2">
        <div>
          <p className="text-xs text-muted-foreground">Assigned total</p>
          <p className="mt-1 font-receipt text-xl font-bold text-primary-strong">
            {formatUsd(toUsd(grandLbp, rate))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Unclaimed items</p>
          <p className="mt-1 font-receipt text-xl font-semibold">
            {formatUsd(toUsd(remainingLbp, rate))}
          </p>
        </div>
      </div>

      {rate ? (
        <p className="mb-3 px-2 text-xs text-muted-foreground">
          Exchange rate{' '}
          <span className="font-receipt tabular-nums">$1 = {formatLbp(rate)}</span>
        </p>
      ) : null}

      <Accordion.Root className="space-y-1">
        {ordered.map((person) => {
          const portfolio = portfolioByPerson.get(person.id)
          if (!portfolio) return null
          return (
            <SplitTotalsPersonRow
              key={person.id}
              person={person}
              portfolio={portfolio}
              lineItems={lineItems}
              claims={claims}
              rate={rate}
              serviceChargeOn={serviceChargeOn}
              tipPercent={tipPercent}
            />
          )
        })}
      </Accordion.Root>

      {extra ? <div className="surface-inset mt-4 px-4 py-3">{extra}</div> : null}
    </>
  )
}
