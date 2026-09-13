import type { ReactNode } from 'react'
import { Accordion } from '@base-ui/react/accordion'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { RiCheckLine, RiTimeLine } from '@remixicon/react'
import { formatLbp } from '~/lib/money'
import { CurrencyAmount } from '../receipt/CurrencyAmount'
import { cn } from '~/lib/utils'
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
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-control bg-primary/10 p-3 ring-1 ring-primary/15">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
            <RiCheckLine className="size-4 shrink-0" aria-hidden /> Assigned
          </p>
          <CurrencyAmount
            lbp={grandLbp}
            usd={[...portfolioByPerson.values()].reduce(
              (sum, p) => sum + p.totalUsd,
              0,
            )}
            rate={rate}
            className="mt-2 block break-words text-lg font-bold text-primary-strong"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Includes tip &amp; charges
          </p>
        </div>
        <div
          className={cn(
            'min-w-0 rounded-control p-3 ring-1',
            remainingLbp > 0
              ? 'bg-warning-subtle text-warning-subtle-foreground ring-warning/20'
              : 'bg-success-subtle text-success-subtle-foreground ring-success/20',
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <RiTimeLine className="size-4 shrink-0" aria-hidden /> Unclaimed
          </p>
          <CurrencyAmount
            lbp={remainingLbp}
            rate={rate}
            className="mt-2 block break-words text-lg font-bold"
          />
          <p className="mt-1 text-[11px]">
            {remainingLbp > 0 ? 'Still needs assigning' : 'All items assigned'}
          </p>
        </div>
      </div>

      {rate ? (
        <p className="mb-3 px-2 text-xs text-muted-foreground">
          Exchange rate{' '}
          <span className="font-receipt tabular-nums">
            $1 = {formatLbp(rate)}
          </span>
        </p>
      ) : null}

      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Everyone’s share
        </h3>
        <span className="text-xs text-muted-foreground">
          {ordered.length} people
        </span>
      </div>
      {ordered.length === 0 ? (
        <p className="surface-inset p-4 text-sm text-muted-foreground">
          Add people and assign items to see their totals here.
        </p>
      ) : null}
      <Accordion.Root className="space-y-2">
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

      {extra ? (
        <div className="surface-inset mt-4 px-4 py-3">{extra}</div>
      ) : null}
    </>
  )
}
