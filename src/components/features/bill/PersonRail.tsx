import type { ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/split'
import { AddPerson } from './AddPerson'
import { PersonBarPill } from './PersonBarPill'
import { PersonPanelRow } from './PersonPanelRow'

// People selector for splitting. Pick a person to make them "active", then pull
// units onto them in the ClaimList (ui-flow-vision.md). Renders as a vertical
// "panel" (desktop aside) or a horizontal "bar" (mobile). Both show each person's
// running USD total; tapping the avatar opens their item breakdown.
export function PersonRail({
  people,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  portfolioByPerson,
  lineItems = [],
  claims = [],
  rate,
  serviceChargeOn = false,
  tipPercent,
  variant = 'panel',
  addLabel = 'Add person',
  addPlaceholder = 'Add person',
  ownIds,
  trailing,
}: {
  people: Person[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd?: (name: string) => void
  onRemove?: (id: string) => void
  portfolioByPerson?: Map<string, Portfolio>
  lineItems?: LineItem[]
  claims?: Claim[]
  rate?: number | null
  serviceChargeOn?: boolean
  tipPercent?: number | null
  variant?: 'panel' | 'bar'
  addLabel?: string
  addPlaceholder?: string
  /** Ids the viewer controls (e.g. a guest's own people). When set, only
   * these render as individual pills/rows; everyone else is left to the
   * caller (in the bar variant, via `trailing`). */
  ownIds?: ReadonlySet<string>
  /** Bar variant only: rendered after the Add pill, inside the same
   * scrollable row — e.g. an "others" summary pill for people not in `ownIds`. */
  trailing?: ReactNode
}) {
  if (variant === 'bar') {
    const ownPeople = ownIds ? people.filter((p) => ownIds.has(p.id)) : people
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {ownPeople.map((p) => (
            <PersonBarPill
              key={p.id}
              person={p}
              active={p.id === activeId}
              portfolio={portfolioByPerson?.get(p.id)}
              lineItems={lineItems}
              claims={claims}
              rate={rate}
              serviceChargeOn={serviceChargeOn}
              tipPercent={tipPercent}
              onSelect={onSelect}
            />
          ))}
        </AnimatePresence>
        {onAdd ? (
          <AddPerson onAdd={onAdd} variant="bar" placeholder={addPlaceholder} />
        ) : null}
        {trailing}
      </div>
    )
  }

  const panelOwnPeople = ownIds ? people.filter((p) => ownIds.has(p.id)) : []
  const panelOtherPeople = ownIds
    ? people.filter((p) => !ownIds.has(p.id))
    : people
  const panelHasOwn = panelOwnPeople.length > 0

  const renderRow = (p: Person) => (
    <PersonPanelRow
      key={p.id}
      person={p}
      active={p.id === activeId}
      portfolio={portfolioByPerson?.get(p.id)}
      lineItems={lineItems}
      claims={claims}
      rate={rate}
      serviceChargeOn={serviceChargeOn}
      tipPercent={tipPercent}
      onSelect={onSelect}
      onRemove={onRemove && people.length > 1 ? onRemove : undefined}
    />
  )

  const addRow = onAdd ? (
    <AddPerson
      onAdd={onAdd}
      variant="panel"
      label={addLabel}
      placeholder={addPlaceholder}
    />
  ) : null

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {panelOwnPeople.map(renderRow)}
      </AnimatePresence>
      {panelHasOwn ? addRow : null}
      <AnimatePresence initial={false}>
        {panelOtherPeople.map(renderRow)}
      </AnimatePresence>
      {panelHasOwn ? null : addRow}
    </div>
  )
}
