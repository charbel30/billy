import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { CurrencyToggle, type Currency } from '~/components/CurrencyToggle'
import { ClaimList } from '~/components/bill/ClaimList'
import { PortfolioReceipt } from '~/components/bill/PortfolioReceipt'
import { RemainingBar } from '~/components/bill/RemainingBar'
import {
  billQueries,
  useAddGuestPerson,
  useJoinSplit,
  useSaveGuestClaims,
} from '~/queries'
import { computePortfolios, personClaimedLines } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
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
  const [currency, setCurrency] = useState<Currency>('USD')
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

  const portfolios = computePortfolios({
    lineItems: bill.lineItems,
    people: bill.people,
    claims: bill.claims,
    serviceCharge: bill.serviceCharge,
    tax: bill.tax,
    serviceChargeOn: bill.serviceChargeOn,
    serviceSplitMode: bill.serviceSplitMode,
    rate: bill.rate,
  })
  const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0)
  const fmt = (lbp: number) =>
    currency === 'LBP' ? formatLbp(lbp) : formatUsd(toUsd(lbp, bill.rate))
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

  async function savePersonClaims(personId: string, nextClaims: Array<{ itemId: string; units: number }>) {
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

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">{bill.merchantName || 'Receipt'}</h1>
          {bill.rate ? (
            <p className="text-xs text-muted-foreground">
              {formatLbp(bill.rate)} / $1
            </p>
          ) : null}
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

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

            <RemainingBar lineItems={bill.lineItems} claims={bill.claims} />

            {conflictMessage ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {conflictMessage}
              </div>
            ) : null}

            <ClaimList
              lineItems={bill.lineItems}
              people={bill.people}
              claims={bill.claims}
              activePerson={activePerson}
              rate={bill.rate}
              onStep={stepClaim}
              onShareEvenly={shareEvenly}
              canShareEvenly={controlledPeople.length > 1}
              sharePeople={controlledPeople}
            />

            {saveGuestClaims.isPending ? (
              <p className="text-xs text-muted-foreground">Saving claim...</p>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-3">
        {portfolios.map((p) => (
          <PortfolioReceipt
            key={p.personId}
            portfolio={p}
            lines={personClaimedLines(p.personId, bill.lineItems, bill.claims)}
            rate={bill.rate}
            currency={currency}
            serviceChargeOn={bill.serviceChargeOn}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <span className="text-muted-foreground">Grand total</span>
        <span className="text-lg font-black tabular-nums">{fmt(grandLbp)}</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          See all items ({bill.lineItems.length})
        </summary>
        <div className="mt-2 space-y-1">
          {bill.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between tabular-nums">
              <span>
                {li.qty}× {li.name}
              </span>
              <span>{fmt(li.lineTotal)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
