import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { BillSplitWorkspace } from '~/components/bill/BillSplitWorkspace'
import { BillSummary } from '~/components/bill/BillSummary'
import {
  billQueries,
  useAddGuestPerson,
  useJoinSplit,
  useSaveGuestClaims,
} from '~/queries'
import type { Claim, Person } from '~/lib/types'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/b/$shareToken')({
  component: GuestView,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(billQueries.byToken(params.shareToken))
  },
})

const guestSessionKey = (shareToken: string) => `bill-guest:${shareToken}`

function getOrCreateGuestSessionId(shareToken: string): string | null {
  if (typeof window === 'undefined') return null
  const key = guestSessionKey(shareToken)
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}

function claimsForPerson(claims: Claim[], personId: string) {
  return claims
    .filter((c) => c.personId === personId && c.units > 0)
    .map((c) => ({ itemId: c.itemId, units: c.units }))
}

function unitsFor(claims: Claim[], itemId: string, personId: string): number {
  return (
    claims.find((c) => c.itemId === itemId && c.personId === personId)?.units ??
    0
  )
}

function PersonPicker({
  people,
  activeId,
  onSelect,
}: {
  people: Person[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const active = p.id === activeId
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            style={active ? { backgroundColor: p.color } : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
              active
                ? 'border-transparent text-white'
                : 'border-border hover:bg-muted',
            )}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: active ? 'white' : p.color }}
            />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

function GuestView() {
  const { shareToken } = Route.useParams()
  const { data: bill } = useSuspenseQuery(billQueries.byToken(shareToken))
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [extraName, setExtraName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  const joinSplit = useJoinSplit()
  const addGuestPerson = useAddGuestPerson()
  const saveGuestClaims = useSaveGuestClaims()

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

  useEffect(() => {
    if (!controlledPeople.some((p) => p.id === activeId)) {
      setActiveId(controlledPeople[0]?.id ?? null)
    }
  }, [controlledPeople, activeId])

  const activePerson = bill.people.find((p) => p.id === activeId) ?? null

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

  async function addPerson() {
    const name = extraName.trim()
    if (!name || !guestSessionId) return
    const result = await addGuestPerson.mutateAsync({
      shareToken,
      guestSessionId,
      name,
    })
    setActiveId(result.personId)
    setExtraName('')
  }

  async function savePersonClaims(
    personId: string,
    nextClaims: Array<{ itemId: string; units: number }>,
  ) {
    if (!guestSessionId) return
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
    void savePersonClaims(personId, nextClaims)
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

  if (bill.status !== 'PUBLISHED' && bill.status !== 'FINALIZED') {
    return (
      <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
        <div className="rounded-3xl border border-border bg-card p-4">
          <h1 className="text-xl font-black">This split is not open yet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask the host to invite people from the split page, then come back to
            this link.
          </p>
        </div>
      </div>
    )
  }

  if (bill.status === 'FINALIZED') {
    return (
      <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
        <BillSummary
          bill={bill}
          title={bill.merchantName || 'Final receipt'}
          description="This split is finalized, so the receipt is read-only."
        />
      </div>
    )
  }

  return (
    <BillSplitWorkspace
      bill={bill}
      description="Join the bill, claim your items, and watch everyone's totals update."
      editorSlot={
        <div className="rounded-3xl border border-border bg-card p-4 space-y-3">
          {controlledPeople.length === 0 ? (
            <>
              <div>
                <h2 className="font-bold">Join the split</h2>
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
            </>
          ) : (
            <>
              <div>
                <h2 className="font-bold">Claim your items</h2>
                <p className="text-sm text-muted-foreground">
                  These edits are scoped to your people, so they won't overwrite
                  the rest of the bill.
                </p>
              </div>

              <PersonPicker
                people={controlledPeople}
                activeId={activeId}
                onSelect={setActiveId}
              />

              <div className="flex gap-2">
                <Input
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void addPerson()}
                  placeholder="Add someone with you"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!extraName.trim() || addGuestPerson.isPending}
                  onClick={() => void addPerson()}
                >
                  Add
                </Button>
              </div>
            </>
          )}
        </div>
      }
      activePerson={activePerson}
      onStep={stepClaim}
      onShareEvenly={shareEvenly}
      canShareEvenly={controlledPeople.length > 1}
      sharePeople={controlledPeople}
      showClaims={controlledPeople.length > 0}
      conflictMessage={conflictMessage}
      savingMessage={saveGuestClaims.isPending ? 'Saving claim...' : null}
    />
  )
}
