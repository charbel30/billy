import { useEffect, useMemo, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import {
  RiDoorLockLine,
  RiInformationLine,
  RiPieChartLine,
  RiUserSmileLine,
} from '@remixicon/react'
import { Alert, AlertTitle } from '~/components/ui/alert'
import { EmptyState } from '~/components/shared/EmptyState'
import {
  BillScreen,
  BillSplitWorkspace,
  BillSummary,
  NameEntryForm,
  SettlementHeader,
  WorkspaceHeader,
} from '~/components/features/bill'
import {
  billQueries,
  useAddGuestPerson,
  useJoinSplit,
  useStepGuestClaim,
  useShareGuestItemEvenly,
  useRestoreGuestItemSplit,
  useSetGuestPersonPaid,
} from '~/api'
import { getOrCreateGuestSessionId } from '~/lib/session'
import { LegalFooter } from '~/components/shared/LegalFooter'
import { trackFunnelMilestone } from '~/lib/observability'
import { settlementProgress } from '~/lib/bill'
import { buildPersonMessage, joinUrl } from '~/lib/format'
import toast from 'react-hot-toast'
import { summaryCopy } from '~/components/features/summary/content'

export function JoinPage({ shareToken }: { shareToken: string }) {
  const { data: bill } = useSuspenseQuery(billQueries.byToken(shareToken))
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selfIdentity, setSelfIdentity] = useState<{ key: string; id: string } | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [sendPendingId, setSendPendingId] = useState<string | null>(null)

  const joinSplit = useJoinSplit()
  const addGuestPerson = useAddGuestPerson()
  const stepGuestClaim = useStepGuestClaim()
  const shareGuestItemEvenly = useShareGuestItemEvenly()
  const restoreGuestItemSplit = useRestoreGuestItemSplit()
  const setGuestPersonPaid = useSetGuestPersonPaid()

  useEffect(() => {
    setGuestSessionId(getOrCreateGuestSessionId(shareToken))
    setSessionReady(true)
  }, [shareToken])

  const { data: controlledIds = [] } = useQuery(
    billQueries.controlledPeople(shareToken, guestSessionId),
  )
  const controlledPeople = useMemo(
    () =>
      guestSessionId
        ? bill.people.filter((p) => controlledIds.includes(p.id))
        : [],
    [bill.people, guestSessionId, controlledIds],
  )
  const ownIds = useMemo(
    () => new Set(controlledPeople.map((p) => p.id)),
    [controlledPeople],
  )

  // Keep the joining person separate from companions, even if the host
  // removes that person. Never silently relabel a companion as “You”.
  const selfStorageKey = `spolio:self:${shareToken}:${guestSessionId}`
  const selfId = selfIdentity?.key === selfStorageKey ? selfIdentity.id : null
  useEffect(() => {
    if (!guestSessionId || selfId) return
    let remembered: string | null = null
    try { remembered = localStorage.getItem(selfStorageKey) } catch { /* Storage is optional. */ }
    const initialId = remembered || controlledPeople[0]?.id
    if (!initialId) return
    setSelfIdentity({ key: selfStorageKey, id: initialId })
    try { localStorage.setItem(selfStorageKey, initialId) } catch { /* Keep identity in memory. */ }
  }, [guestSessionId, selfId, selfStorageKey, controlledPeople])

  // Owned (controlled by this session): drives the "(you)" label, the paid
  // toggle, sending a person's total, and the default selection.
  const isMine = (personId: string) =>
    controlledPeople.some((p) => p.id === personId)
  // Claimable: once joined, a guest claims and splits for anyone at the table
  // (same footing as the host). The server enforces the joined-session gate.
  const joined = controlledPeople.length > 0
  const isAtTable = (personId: string) =>
    bill.people.some((p) => p.id === personId)

  useEffect(() => {
    if (!bill.people.some((p) => p.id === activeId)) {
      setActiveId(controlledPeople[0]?.id ?? null)
    }
  }, [bill.people, controlledPeople, activeId])

  async function join(name: string) {
    if (!name || !guestSessionId) return
    const result = await joinSplit.mutateAsync({
      shareToken,
      guestSessionId,
      name,
    })
    setSelfIdentity({ key: selfStorageKey, id: result.personId })
    try { localStorage.setItem(selfStorageKey, result.personId) } catch { /* Keep identity in memory. */ }
    trackFunnelMilestone('guest_joined')
    setActiveId(result.personId)
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
    if (
      !guestSessionId ||
      !joined ||
      !isAtTable(personId) ||
      (delta !== 1 && delta !== -1)
    )
      return
    setConflictMessage(null)
    void stepGuestClaim
      .mutateAsync({ shareToken, guestSessionId, personId, itemId, delta })
      .then((result) => {
        if (result.rejectedCount > 0) {
          setConflictMessage(
            'Some units were already claimed, so we kept only what was still available.',
          )
        }
      })
      .catch(() =>
        setConflictMessage('That claim could not be saved. Please try again.'),
      )
  }

  async function shareEvenly(itemId: string, personIds: string[], quantity: number) {
    if (
      !guestSessionId ||
      !joined ||
      personIds.length === 0 ||
      personIds.some((id) => !isAtTable(id))
    )
      throw new Error('Join the table, then choose people at it')
    setConflictMessage(null)
    const { before, after, qty } = await shareGuestItemEvenly.mutateAsync({ shareToken, guestSessionId, itemId, personIds, quantity })
    return async () => {
      await restoreGuestItemSplit.mutateAsync({ shareToken, guestSessionId, itemId, before, after, qty })
    }
  }

  function togglePaid(personId: string, paid: boolean) {
    if (!guestSessionId || !isMine(personId)) return
    setGuestPersonPaid.mutate({ shareToken, guestSessionId, personId, paid })
  }

  async function sendPerson(personId: string) {
    if (!isMine(personId)) return
    const person = bill.people.find((p) => p.id === personId)
    const text = buildPersonMessage(bill, personId, {
      joinUrl: joinUrl(shareToken),
    })
    setSendPendingId(personId)
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text })
          return
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }
      await navigator.clipboard.writeText(text)
      toast.success(summaryCopy.sendCopied(person?.name.trim() || 'their'))
    } catch {
      toast(text)
    } finally {
      setSendPendingId(null)
    }
  }

  if (bill.status !== 'PUBLISHED' && bill.status !== 'FINALIZED') {
    return <NotOpenNotice />
  }

  if (bill.status === 'FINALIZED') {
    return (
      <BillScreen
        width="narrow"
        header={
          <WorkspaceHeader
            merchantName={bill.merchantName}
            status={bill.status}
            rate={bill.rate}
            icon={RiPieChartLine}
            description={summaryCopy.headerDescription.finalized}
          />
        }
        notice={
          <Alert variant="info">
            <RiInformationLine />
            <AlertTitle>{summaryCopy.joinFinalized}</AlertTitle>
          </Alert>
        }
      >
        <SettlementHeader
          rate={bill.rate}
          progress={settlementProgress(bill)}
          labels={summaryCopy.header}
        />
        <BillSummary
          bill={bill}
          header={null}
          hideGrandTotal
          sortUnpaidFirst
          nothingClaimedLabel={summaryCopy.nothingClaimed}
          onTogglePaid={togglePaid}
          canTogglePaid={isMine}
          paidPendingId={
            setGuestPersonPaid.isPending
              ? (setGuestPersonPaid.variables?.personId ?? null)
              : null
          }
          onSend={(personId) => void sendPerson(personId)}
          sendPendingId={sendPendingId}
          sendLabel={summaryCopy.sendAria}
        />
        <LegalFooter />
      </BillScreen>
    )
  }

  return (
    <BillSplitWorkspace
      bill={bill}
      description="Join the bill, claim your items, and watch the whole table update live."
      notice={
        sessionReady && !guestSessionId ? (
          <Alert variant="warning">
            <AlertTitle>
              Enable site storage or use another browser to join. You can still
              view this bill.
            </AlertTitle>
          </Alert>
        ) : bill.guestAccessReset ? (
          <Alert variant="info">
            <AlertTitle>
              Guest access was reset for security. The host can still manage
              previous names and claims. Ask the host before adding your name
              again.
            </AlertTitle>
          </Alert>
        ) : null
      }
      panelTitle="Everyone on the bill"
      addLabel="Add someone with you"
      addPlaceholder="Add someone"
      panelExtra={
        joined ? null : (
          <section className="surface-card space-y-5 p-5 sm:p-6">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/20 text-primary-strong">
              <RiUserSmileLine className="size-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-tight">What’s your name?</h2>
              <p className="text-sm text-muted-foreground">Join the table, then tap to pick what you had.</p>
            </div>
            <NameEntryForm joining submitLabel="Join the table" pendingLabel="Joining…" disabled={!guestSessionId} onSubmit={join} />
          </section>
        )
      }
      // The whole table is visible (same view as the host's split screen).
      // Once joined, a guest can select anyone and claim/split for them;
      // paid toggles and sending stay gated on `isMine`. No onRemove —
      // guests never remove anyone.
      people={bill.people}
      selfId={selfId ?? undefined}
      activeId={activeId}
      onSelect={(id) => {
        if (isAtTable(id)) setActiveId(id)
      }}
      onAdd={joined ? addPerson : undefined}
      onStep={stepClaim}
      onShareEvenly={shareEvenly}
      canShareEvenly={bill.people.length > 1}
      sharePeople={bill.people}
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
