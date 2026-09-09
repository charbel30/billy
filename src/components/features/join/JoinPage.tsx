import { useEffect, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RiDoorLockLine, RiInformationLine, RiLoader4Line } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Alert, AlertTitle } from '~/components/ui/alert'
import { EmptyState } from '~/components/shared/EmptyState'
import { BillSplitWorkspace, BillSummary } from '~/components/features/bill'
import {
  billQueries,
  useAddGuestPerson,
  useJoinSplit,
  useStepGuestClaim,
  useShareGuestItemEvenly,
  useSetGuestPersonPaid,
} from '~/api'
import { getOrCreateGuestSessionId } from '~/lib/session'
import { LegalFooter } from '~/components/shared/LegalFooter'
import { trackFunnelMilestone } from '~/lib/observability'

export function JoinPage({ shareToken }: { shareToken: string }) {
  const { data: bill } = useSuspenseQuery(billQueries.byToken(shareToken))
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  const joinSplit = useJoinSplit()
  const addGuestPerson = useAddGuestPerson()
  const stepGuestClaim = useStepGuestClaim()
  const shareGuestItemEvenly = useShareGuestItemEvenly()
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
    trackFunnelMilestone('guest_joined')
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

  function stepClaim(itemId: string, personId: string, delta: number) {
    if (!guestSessionId || !isMine(personId) || (delta !== 1 && delta !== -1)) return
    setConflictMessage(null)
    void stepGuestClaim.mutateAsync({ shareToken, guestSessionId, personId, itemId, delta })
      .then((result) => {
        if (result.rejectedCount > 0) {
          setConflictMessage('Some units were already claimed, so we kept only what was still available.')
        }
      })
      .catch(() => setConflictMessage('That claim could not be saved. Please try again.'))
  }

  function shareEvenly(itemId: string, personIds: string[]) {
    if (!guestSessionId || personIds.length === 0 || personIds.some((id) => !isMine(id))) return
    setConflictMessage(null)
    void shareGuestItemEvenly.mutateAsync({ shareToken, guestSessionId, itemId, personIds })
      .then((result) => {
        if (result.rejectedCount > 0) {
          setConflictMessage('Some units were already claimed, so we split only what was still available.')
        }
      })
      .catch(() => setConflictMessage('That split could not be saved. Please try again.'))
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
        <Alert variant="info">
          <RiInformationLine />
          <AlertTitle>This split is finalized — the receipt is locked.</AlertTitle>
        </Alert>
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
          <div className="space-y-3 rounded-card bg-background/85 p-4 shadow-card ring-1 ring-border/35">
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
                className="focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <Button
                type="button"
                disabled={!joinName.trim() || joinSplit.isPending}
                onClick={() => void join()}
              >
                {joinSplit.isPending ? (
                  <RiLoader4Line className="animate-spin" />
                ) : null}
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
      ownIds={ownIds}
    />
  )
}

function NotOpenNotice() {
  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div className="rounded-card border border-border bg-card p-4 shadow-card">
        <EmptyState
          icon={RiDoorLockLine}
          title="This split is not open yet"
          hint="Ask the host to invite people from the split page. This page updates by itself the moment the split opens — no need to refresh."
        />
      </div>
      <LegalFooter />
    </div>
  )
}
