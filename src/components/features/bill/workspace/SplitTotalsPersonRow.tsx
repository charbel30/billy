import { Accordion } from '@base-ui/react/accordion'
import { RiArrowDownSLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { personClaimedLines, formatLbp, formatUsd, toUsd } from '~/lib/money'
import { formatUnits } from '~/lib/format'
import { PersonAvatar } from '../people'

/** One tap-to-reveal person breakdown inside the split dock's totals panel. */
export function SplitTotalsPersonRow({
  person,
  portfolio,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
}: {
  person: Person
  portfolio: Portfolio
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
}) {
  const lines = personClaimedLines(person.id, lineItems, claims)

  return (
    <Accordion.Item value={person.id} className="surface-inset">
      <Accordion.Header>
        <Accordion.Trigger className="group flex min-h-16 w-full items-center gap-3 rounded-control px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          <PersonAvatar name={person.name} color={person.color} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{person.name}</span>
            <span className="block text-xs text-muted-foreground">
              {lines.length === 0
                ? 'Nothing claimed yet'
                : `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`}
            </span>
          </span>
          <span className="shrink-0 font-receipt text-sm font-semibold">
            {formatUsd(portfolio.totalUsd)}
          </span>
          <RiArrowDownSLine
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-180 motion-reduce:transition-none"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="overflow-hidden">
        <div className="space-y-3 px-3 pb-4 pt-1">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Claim items from the receipt to see them here.
            </p>
          ) : (
            lines.map((line) => (
              <div
                key={line.itemId}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0 break-words text-muted-foreground">
                  {formatUnits(line.units)} × {line.name}
                </span>
                <span className="shrink-0 font-receipt">
                  {formatUsd(toUsd(line.lbp, rate))}
                </span>
              </div>
            ))
          )}
          {serviceChargeOn && portfolio.serviceShareLbp !== 0 ? (
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Service &amp; tax</span>
              <span className="font-receipt">
                {formatUsd(toUsd(portfolio.serviceShareLbp, rate))}
              </span>
            </div>
          ) : null}
          {portfolio.tipShareLbp !== 0 ? (
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Tip{tipPercent ? ` (${tipPercent}%)` : ''}</span>
              <span className="font-receipt">
                {formatUsd(toUsd(portfolio.tipShareLbp, rate))}
              </span>
            </div>
          ) : null}
          <p className="border-t border-border/50 pt-2 text-right font-receipt text-xs text-muted-foreground">
            Total {formatLbp(portfolio.totalLbp)}
          </p>
        </div>
      </Accordion.Panel>
    </Accordion.Item>
  )
}
