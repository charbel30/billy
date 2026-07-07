import { AnimatePresence } from 'motion/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import { remainingUnits } from '~/lib/split'
import { tapHaptic } from '~/lib/haptics'
import { ClaimListItem } from './ClaimListItem'

// Pull units off each receipt line onto the active person (ui-flow-vision.md):
// pick a person → +1/-1 per item. Tapping a claimant's avatar removes one of
// THEIR units (without changing who's active). A line greys out + collapses to a
// check once it's fully assigned. "Split evenly" is the compact group button.
export function ClaimList({
  lineItems,
  people,
  claims,
  activePerson,
  rate,
  onStep,
  onShareEvenly,
  canShareEvenly = true,
  sharePeople = people,
  pendingItemId,
}: {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  activePerson: Person | null
  rate: number | null | undefined
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: (itemId: string, personIds: string[]) => void
  canShareEvenly?: boolean
  sharePeople?: Person[]
  /** Item with a claim write in flight — its unit count pulses while saving. */
  pendingItemId?: string | null
}) {
  const personById = new Map(people.map((p) => [p.id, p]))

  function step(itemId: string, personId: string, delta: number) {
    tapHaptic()
    onStep(itemId, personId, delta)
  }

  // Unclaimed items float to the top; fully-claimed ones sink (stable sort, so
  // receipt order is preserved within each group and `layout` animates the move).
  const doneById = new Map(
    lineItems.map((item) => [item.id, remainingUnits(item, claims) <= 0.0001]),
  )
  const sortedItems = [...lineItems].sort(
    (a, b) => Number(doneById.get(a.id)) - Number(doneById.get(b.id)),
  )

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {sortedItems.map((item) => (
          <ClaimListItem
            key={item.id}
            item={item}
            claims={claims}
            personById={personById}
            activePerson={activePerson}
            rate={rate}
            onStep={step}
            onShareEvenly={onShareEvenly}
            canShareEvenly={canShareEvenly}
            sharePeople={sharePeople}
            pending={pendingItemId === item.id}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
