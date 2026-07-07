import { useEffect, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { BillSplitWorkspace } from '~/components/features/bill/BillSplitWorkspace'
import { BillSummary } from '~/components/features/bill/BillSummary'
import {
  billQueries,
  useAddGuestPerson,
  useJoinSplit,
  useSaveGuestClaims,
  useSetGuestPersonPaid,
} from '~/api'
import { claimsForPerson, unitsFor } from '~/lib/claims'
import { getOrCreateGuestSessionId } from '~/lib/guestSession'
import { LegalFooter } from '~/components/shared/LegalFooter'

export function JoinPage({ shareToken }: { shareToken: string }) {
  const { data: bill } = useSuspenseQuery(billQueries.byToken(shareToken))
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  // The item whose claim write is round-tripping — drives the pending pulse.
  const [stepPendingItemId, setStepPendingItemId] = useState<string | null>(null)

  const joinSplit = useJoinSplit()
  const addGuestPerson = useAddGuestPerson()
  const saveGuestClaims = useSaveGuestClaims()
  const setGuestPersonPaid = useSetGuestPersonPaid()

  useEffect(() => {
    setGuestSessionId(getOrCreateGuestSessionId(shareToken))
  }, [shareToken])

  const controlledPeople = useMemo(
    () =>
      guestSessionId
        ? bill.people.filter((p) => p.guestSessionId === guestSessionId)
        : [],
    [bill.people, guestSessionId],
  )
  const ownIds = useMemo(
    () => new Set(controlledPeople.map((p) => p.id)),
    [controlledPeople],
  )

  const isMine = (personId: string) =>
    controlledPeople.some((p) => p.id === personId)

  useEffect(() => {
    if (!controlledPeople.some((p) => p.id === activeId)) {
      setActiveId(controlledPeople[0]?.id ?? null)
    }
  }, [controlledPeople, activeId])

  async function join() {
    const name = joinName.trim()
    if (!name || !guestSessionId) return
    const result = await joinSplit.mutateAsync({
      shareToken,
      guestSessionId,
      name,
    })
    setActiveId(result.personId)
    setJoinName('')
  }

  async function addPerson(rawName: string) {
    const name = rawName.trim()
    if (!name || !guestSessionId) return
    const result = await addGuestPerson.mutateAsync({
      shareToken,
      guestSessionId,
      name,
    })
    setActiveId(result.personId)
  }

  async function savePersonClaims(
    personId: string,
    nextClaims: Array<{ itemId: string; units: number }>,
  ) {
    if (!guestSessionId || !isMine(personId)) return
    const result = await saveGuestClaims.mutateAsync({
      shareToken,
      guestSessionId,
      personId,
      claims: nextClaims,
    })
    setConflictMessage(
      result.rejectedCount > 0
        ? 'Some units were already claimed, so we kept only what was still available.'
        : null,
    )
  }

  function stepClaim(itemId: string, personId: string, delta: number) {
    const current = unitsFor(bill.claims, itemId, personId)
    const nextUnits = Math.max(0, current + delta)
    const nextClaims = claimsForPerson(bill.claims, personId).filter(
      (c) => c.itemId !== itemId,
    )
    if (nextUnits > 0) nextClaims.push({ itemId, units: nextUnits })
    setStepPendingItemId(itemId)
    void savePersonClaims(personId, nextClaims).finally(() => {
      setStepPendingItemId((cur) => (cur === itemId ? null : cur))
    })
  }

  function shareEvenly(itemId: string, personIds: string[]) {
    const item = bill.lineItems.find((li) => li.id === itemId)
    if (!item || personIds.length === 0) return
    for (const personId of personIds) {
      const nextClaims = claimsForPerson(bill.claims, personId).filter(
        (c) => c.itemId !== itemId,
      )
      nextClaims.push({ itemId, units: item.qty / personIds.length })
      void savePersonClaims(personId, nextClaims)
    }
  }

  function togglePaid(personId: string, paid: boolean) {
    if (!guestSessionId || !isMine(personId)) return
    setGuestPersonPaid.mutate({ shareToken, guestSessionId, personId, paid })
  }

  if (bill.status !== 'PUBLISHED' && bill.status !== 'FINALIZED') {
    return <NotOpenNotice />
  }

  if (bill.status === 'FINALIZED') {
    return (
      <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
        <BillSummary
          bill={bill}
          title={bill.merchantName || 'Final receipt'}
          description="This split is finalized, so the receipt is read-only."
          onTogglePaid={togglePaid}
          canTogglePaid={isMine}
          paidPendingId={
            setGuestPersonPaid.isPending
              ? (setGuestPersonPaid.variables?.personId ?? null)
              : null
          }
        />
        <LegalFooter />
      </div>
    )
  }

  const joined = controlledPeople.length > 0

  return (
    <BillSplitWorkspace
      bill={bill}
      description="Join the bill, claim your items, and watch the whole table update live."
      panelTitle="Everyone on the bill"
      addLabel="Add someone with you"
      addPlaceholder="Add someone"
      panelExtra={
        joined ? null : (
          <div className="space-y-3 rounded-3xl bg-background/85 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)] ring-1 ring-border/35">
            <div>
              <h2 className="font-black">Join the split</h2>
              <p className="text-sm text-muted-foreground">
                Add your name, then claim the items that are yours.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void join()}
                placeholder="Your name"
              />
              <Button
                type="button"
                disabled={!joinName.trim() || joinSplit.isPending}
                onClick={() => void join()}
              >
                Join
              </Button>
            </div>
          </div>
        )
      }
      // The whole table is visible (same view as the host's split screen) but
      // read-only for everyone except your own people: selection, claim
      // steppers, and paid toggles are all gated on `isMine`. No onRemove —
      // guests never remove anyone.
      people={bill.people}
      activeId={activeId}
      onSelect={(id) => {
        if (isMine(id)) setActiveId(id)
      }}
      onAdd={joined ? addPerson : undefined}
      onStep={stepClaim}
      onShareEvenly={shareEvenly}
      canShareEvenly={controlledPeople.length > 1}
      sharePeople={controlledPeople}
      showClaims={joined}
      conflictMessage={conflictMessage}
      savingMessage={saveGuestClaims.isPending ? 'Saving claim...' : null}
      pendingItemId={stepPendingItemId}
      ownIds={ownIds}
    />
  )
}

function NotOpenNotice() {
  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div className="rounded-3xl border border-border bg-card p-4">
        <h1 className="text-xl font-black">This split is not open yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask the host to invite people from the split page. This page
          updates by itself the moment the split opens — no need to refresh.
        </p>
      </div>
      <LegalFooter />
    </div>
  )
}
