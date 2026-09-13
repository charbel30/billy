import { Accordion } from '@base-ui/react/accordion'
import { RiArrowDownSLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { personClaimedLines } from '~/lib/money'
import { formatUnits } from '~/lib/format'
import { PersonAvatar } from '../people'
import { CurrencyAmount } from '../receipt/CurrencyAmount'

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
    <Accordion.Item
      value={person.id}
      className="surface-inset overflow-hidden ring-1 ring-border/40 transition-[background-color,box-shadow] data-panel-open:bg-card data-panel-open:ring-primary/25"
    >
      <Accordion.Header>
        <Accordion.Trigger className="group flex min-h-16 w-full items-center gap-3 rounded-control px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          <PersonAvatar
            name={person.name}
            color={person.color}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {person.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {lines.length === 0
                ? 'Nothing claimed yet'
                : `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`}
            </span>
          </span>
          <span className="max-w-[45%] break-words text-right font-receipt text-sm font-semibold">
            <CurrencyAmount
              lbp={portfolio.totalLbp}
              usd={portfolio.totalUsd}
              rate={rate}
            />
          </span>
          <RiArrowDownSLine
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-180 motion-reduce:transition-none"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height,opacity] duration-200 data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 motion-reduce:transition-none">
        <div className="mx-3 space-y-3 border-t border-dashed border-border pb-4 pt-3">
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
                <span className="min-w-0 break-words text-foreground/85">
                  <span className="mr-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 font-receipt text-xs text-primary-strong">
                    {formatUnits(line.units)} ×
                  </span>{' '}
                  {line.name}
                </span>
                <span className="shrink-0 font-receipt">
                  <CurrencyAmount lbp={line.lbp} rate={rate} />
                </span>
              </div>
            ))
          )}
          {serviceChargeOn && portfolio.serviceShareLbp !== 0 ? (
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Service &amp; tax</span>
              <span className="font-receipt">
                <CurrencyAmount lbp={portfolio.serviceShareLbp} rate={rate} />
              </span>
            </div>
          ) : null}
          {portfolio.tipShareLbp !== 0 ? (
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Tip{tipPercent ? ` (${tipPercent}%)` : ''}</span>
              <span className="font-receipt">
                <CurrencyAmount lbp={portfolio.tipShareLbp} rate={rate} />
              </span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-3">
            <span className="text-xs font-bold">Total share</span>
            <CurrencyAmount
              lbp={portfolio.totalLbp}
              usd={portfolio.totalUsd}
              rate={rate}
              secondary
              className="text-right text-base font-bold text-primary-strong"
            />
          </div>
        </div>
      </Accordion.Panel>
    </Accordion.Item>
  )
}
