import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { MobilePersonPicker, MobileAddPerson } from '../people'

/**
 * Declared collapsed height of the split dock at 390px: 64px handle + 20px
 * padding + a 56px person rail, its 21px hint line, and the 48px add/action
 * row with 10px gaps. Only has to be right for the first frame — the dock
 * re-measures these rows itself and corrects before paint.
 */
export const SPLIT_DOCK_COLLAPSED_HINT = 224

/**
 * Collapsed rows of the split/join dock: who you are picking for, the inline
 * add-person form, and the screen's primary action.
 */
export function SplitDockCollapsed({
  people,
  activeId,
  selfId,
  onSelect,
  onAdd,
  portfolioByPerson,
  ownIds,
  readOnlyIds,
  selfAction,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
  panelExtra,
  actionSlot,
}: {
  people: Person[]
  activeId: string | null
  selfId?: string
  onSelect: (id: string) => void
  onAdd?: (name: string) => void | Promise<void>
  portfolioByPerson: Map<string, Portfolio>
  /** Ids the viewer controls (a guest's own people) — sorted first in the
   * picker. */
  ownIds?: ReadonlySet<string>
  /** Shown but not selectable (a guest viewing the host's person). */
  readOnlyIds?: ReadonlySet<string>
  /** Rendered right after `selfId`'s pill (the host's rename button). */
  selfAction?: ReactNode
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
  panelExtra?: ReactNode
  actionSlot?: ReactNode
}) {
  const [editingPerson, setEditingPerson] = useState(false)

  return (
    <div className="space-y-2.5">
      {panelExtra ? <div>{panelExtra}</div> : null}
      <MobilePersonPicker
        people={people}
        activeId={activeId}
        selfId={selfId}
        onSelect={onSelect}
        portfolioByPerson={portfolioByPerson}
        ownIds={ownIds}
        readOnlyIds={readOnlyIds}
        selfAction={selfAction}
        lineItems={lineItems}
        claims={claims}
        rate={rate}
        serviceChargeOn={serviceChargeOn}
        tipPercent={tipPercent}
      />
      {onAdd ? (
        <MobileAddPerson
          onAdd={onAdd}
          actionSlot={actionSlot}
          editing={editingPerson}
          onEditingChange={setEditingPerson}
        />
      ) : actionSlot ? (
        <div className="space-y-2">{actionSlot}</div>
      ) : null}
    </div>
  )
}
