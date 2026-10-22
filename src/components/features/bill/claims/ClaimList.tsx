import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { ShareItemEvenly } from '~/lib/bill'
import type { Claim, LineItem, Person } from '~/lib/types'
import { remainingUnits } from '~/lib/money'
import { tapHaptic } from '~/lib/ui'
import { ClaimListItem } from './ClaimListItem'
import { ItemOrderSplit } from './ItemOrderSplit'
import { SplitSavedToast } from './SplitSavedToast'

// Pull units off each receipt line onto the active person (ui-flow-vision.md):
// Whole orders use the stepper; the inline splitter adds shares of unclaimed orders.
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
  readOnlyIds,
}: {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  activePerson: Person | null
  rate: number | null | undefined
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: ShareItemEvenly
  canShareEvenly?: boolean
  /** People who can be included in an even split. */
  sharePeople?: Person[]
  /** Of those, people the viewer may NOT claim or unclaim for directly (a
   * guest viewing the host's person): their claim pills and steppers are
   * disabled, but they still appear in the split sheet. */
  readOnlyIds?: ReadonlySet<string>
}) {
  const personById = new Map(people.map((p) => [p.id, p]))
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [sharingPeople, setSharingPeople] = useState(() => new Set<string>())
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Who the steppers / claim pills may change vs. who a split may include.
  const claimableIds = new Set(
    sharePeople.filter((person) => !readOnlyIds?.has(person.id)).map((person) => person.id),
  )
  const everyoneSelected = sharePeople.length > 0 && sharePeople.every((person) => sharingPeople.has(person.id))

  function toggleShare(itemId: string) {
    tapHaptic()
    if (sharingId === itemId) {
      setSharingId(null)
      return
    }
    setSharingId(itemId)
    setSharingPeople(new Set(sharePeople.map((person) => person.id)))
  }

  function step(itemId: string, personId: string, delta: number) {
    if (pendingId === itemId) return
    tapHaptic()
    onStep(itemId, personId, delta)
  }

  // Unclaimed items float to the top; fully-claimed ones sink (stable sort, so
  // receipt order is preserved within each group and `layout` animates the move).
  const doneById = new Map(
    lineItems.map((item) => [item.id, item.id !== sharingId && remainingUnits(item, claims) <= 0.0001]),
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
            onShare={() => toggleShare(item.id)}
            onSelectEveryone={() => {
              tapHaptic()
              setSharingPeople(new Set(sharePeople.map((person) => person.id)))
            }}
            everyoneSelected={everyoneSelected}
            canShare={canShareEvenly && sharePeople.length > 1}
            sharingOpen={sharingId === item.id}
            pending={pendingId !== null}
            editableIds={claimableIds}
          >
            {sharingId === item.id ? (
              <ItemOrderSplit
                item={item}
                claims={claims}
                people={sharePeople}
                selected={sharingPeople}
                onSelectedChange={setSharingPeople}
                activePerson={activePerson}
                rate={rate}
                restricted={sharePeople.length < people.length}
                onClose={() => setSharingId(null)}
                onSave={async (itemId, personIds, quantity) => {
                  setPendingId(itemId)
                  try { return await onShareEvenly(itemId, personIds, quantity) }
                  finally { setPendingId(null) }
                }}
                onSaved={(undo) => {
                  tapHaptic([8, 30, 8])
                  const savedAt = Date.now()
                  toast((t) => <SplitSavedToast key={savedAt} itemName={item.name} undo={undo} toastId={t.id} />, { id: `item-split-${item.id}`, duration: 8000 })
                }}
              />
            ) : null}
          </ClaimListItem>
        ))}
      </AnimatePresence>
    </div>
  )
}
