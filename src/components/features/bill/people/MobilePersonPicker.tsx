import { useState } from 'react'
import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { formatUsd, personClaimedLines } from '~/lib/money'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { cn } from '~/lib/utils'
import { PersonAvatar } from './PersonAvatar'
import { NameEntryForm } from './NameEntryForm'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '~/components/ui/popover'
import { PortfolioReceipt } from '../receipt'

export function MobilePersonPicker({
  people,
  activeId,
  selfId,
  onSelect,
  onAdd,
  portfolioByPerson,
  ownIds,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
}: {
  people: Person[]
  activeId: string | null
  selfId?: string
  onSelect: (id: string) => void
  onAdd?: (name: string) => void | Promise<void>
  portfolioByPerson: Map<string, Portfolio>
  ownIds?: ReadonlySet<string>
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const selectable = ownIds ? people.filter((person) => ownIds.has(person.id)) : people
  const ordered = [
    ...selectable.filter((person) => person.id === selfId),
    ...selectable.filter((person) => person.id !== selfId),
  ]
  const active = selectable.find((person) => person.id === activeId)
  const activePortfolio = active ? portfolioByPerson.get(active.id) : undefined
  const canReturn = selfId && activeId !== selfId && selectable.some((person) => person.id === selfId)

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return
      setOpen(next)
    }}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-control bg-background pl-1">
          {active ? (
            <Popover>
              <PopoverTrigger
                aria-label={active.id === selfId ? 'Your claimed items and total' : `${active.name}’s claimed items and total`}
                className="grid size-12 shrink-0 place-items-center rounded-control transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <PersonAvatar name={active.name} color={active.color} />
              </PopoverTrigger>
              <PopoverContent side="top" align="start" sideOffset={12} className="max-h-[60dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain">
                <PopoverTitle className="sr-only">{active.id === selfId ? "Your claimed items" : `${active.name}’s claimed items`}</PopoverTitle>
                {activePortfolio ? (
                  <PortfolioReceipt
                    portfolio={activePortfolio}
                    lines={personClaimedLines(active.id, lineItems, claims)}
                    rate={rate}
                    serviceChargeOn={serviceChargeOn}
                    tipPercent={tipPercent}
                    bare
                  />
                ) : <p className="text-sm text-muted-foreground">Nothing claimed yet</p>}
              </PopoverContent>
            </Popover>
          ) : null}
          <DialogTrigger
            aria-label={`Picking for ${active?.name ?? 'no one'}. Choose a person`}
            className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-control bg-background pl-1 pr-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">Picking for</span>
              <span className="block truncate text-sm font-bold" aria-live="polite">{active?.name ?? 'Choose a person'}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatUsd(active ? portfolioByPerson.get(active.id)?.totalUsd ?? 0 : 0)}
            </span>
            <RiArrowDownSLine className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </DialogTrigger>
        </div>
        {canReturn ? (
          <Button variant="ghost" className="min-h-11 shrink-0 px-2 text-xs" onClick={() => onSelect(selfId)}>
            Back to me
          </Button>
        ) : null}
      </div>
      <DialogContent
        showCloseButton={!pending}
        className="top-auto bottom-0 start-0 max-w-full translate-x-0 translate-y-0 gap-4 rounded-b-none pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:start-1/2 sm:max-w-md sm:-translate-x-1/2"
      >
        <DialogHeader>
          <DialogTitle>Choose a person</DialogTitle>
          <DialogDescription>Who are you picking items for?</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain">
          {ordered.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={pending}
              aria-pressed={person.id === activeId}
              onClick={() => {
                onSelect(person.id)
                setOpen(false)
              }}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                person.id === activeId && 'bg-primary/15',
              )}
            >
              <PersonAvatar name={person.name} color={person.color} className="shrink-0" />
              <span className="min-w-0 flex-1 break-words font-semibold">{person.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatUsd(portfolioByPerson.get(person.id)?.totalUsd ?? 0)}
              </span>
              <span className="size-5 shrink-0">
                {person.id === activeId ? <RiCheckLine className="size-5 text-primary-strong" aria-hidden /> : null}
              </span>
            </button>
          ))}
        </div>
        {onAdd ? (
          <NameEntryForm
            compact
            submitLabel="Add"
            pendingLabel="Adding…"
            onSubmit={async (name) => {
              setPending(true)
              try {
                await onAdd(name)
                setOpen(false)
              } finally {
                setPending(false)
              }
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
