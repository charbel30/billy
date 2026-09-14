import { useEffect, useRef, useState } from 'react'
import { RiGroupLine, RiCheckLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { formatUsd } from '~/lib/money'
import { BottomSheet } from '~/components/ui/bottom-sheet'
import { cn } from '~/lib/utils'
import { tapHaptic } from '~/lib/ui'
import { PersonAvatar } from './PersonAvatar'
import { MobilePersonPill } from './MobilePersonPill'

export function MobilePersonPicker({ people, activeId, selfId, onSelect, portfolioByPerson, ownIds, lineItems, claims, rate, serviceChargeOn, tipPercent }: {
  people: Person[]
  activeId: string | null
  selfId?: string
  onSelect: (id: string) => void
  portfolioByPerson: Map<string, Portfolio>
  ownIds?: ReadonlySet<string>
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
}) {
  const [open, setOpen] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const canSelect = (id: string) => !ownIds || ownIds.has(id)
  const ordered = [
    ...people.filter((person) => person.id === selfId),
    ...people.filter((person) => person.id !== selfId && canSelect(person.id)),
    ...people.filter((person) => person.id !== selfId && !canSelect(person.id)),
  ]
  const active = people.find((person) => person.id === activeId && canSelect(person.id))

  useEffect(() => {
    const rail = railRef.current
    const selected = activeRef.current
    if (!rail || !selected || open) return
    // Scroll only this strip, never the receipt or the fixed sheet's ancestors.
    const railBox = rail.getBoundingClientRect()
    const selectedBox = selected.getBoundingClientRect()
    const delta = selectedBox.left < railBox.left
      ? selectedBox.left - railBox.left - 4
      : selectedBox.right > railBox.right ? selectedBox.right - railBox.right + 4 : 0
    if (delta) rail.scrollBy({ left: delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [activeId, people.length, open])

  function select(id: string) {
    if (!canSelect(id)) return
    tapHaptic()
    onSelect(id)
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <div ref={railRef} role="group" aria-label="Pick items for a person" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain py-1 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ordered.map((person) => (
            <MobilePersonPill key={person.id} person={person} active={person.id === activeId} buttonRef={person.id === activeId ? activeRef : undefined}
              readOnly={!canSelect(person.id)} onSelect={select} portfolio={portfolioByPerson.get(person.id)} lineItems={lineItems} claims={claims} rate={rate} serviceChargeOn={serviceChargeOn} tipPercent={tipPercent} />
          ))}
          {ordered.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Add someone to start.</p> : null}
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label={`Choose person, ${ordered.length} people`} className="relative grid size-11 shrink-0 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border/50 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <RiGroupLine className="size-5" aria-hidden />
          <span aria-hidden className="absolute -right-0.5 -top-0.5 grid min-w-4 h-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">{ordered.length}</span>
        </button>
      </div>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">Hold an avatar to see their total.</p>
      <p role="status" className="sr-only">Picking for {active?.name ?? 'no one'}</p>
      <BottomSheet open={open} onOpenChange={setOpen} title="Choose a person" description="Who are you picking items for?" responsive>
        <div className="max-h-[50dvh] space-y-1">
          {ordered.map((person) => (
            <button key={person.id} type="button" disabled={!canSelect(person.id)} aria-pressed={person.id === activeId} onClick={() => { select(person.id); setOpen(false) }}
              className={cn('flex min-h-14 w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring', person.id === activeId && 'bg-primary/15')}>
              <PersonAvatar name={person.name} color={person.color} className="shrink-0" />
              <span className="min-w-0 flex-1 break-words font-semibold">{person.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatUsd(portfolioByPerson.get(person.id)?.totalUsd ?? 0)}</span>
              <span className="size-5 shrink-0">{person.id === activeId ? <RiCheckLine className="size-5 text-primary-strong" aria-hidden /> : null}</span>
            </button>
          ))}
          {ordered.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Use Add person below the receipt to get started.</p> : null}
        </div>
      </BottomSheet>
    </>
  )
}
