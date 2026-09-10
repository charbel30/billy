import { useState } from 'react'
import { RiArrowDownSLine, RiCheckLine, RiUserAddLine } from '@remixicon/react'
import type { Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { formatUsd } from '~/lib/money'
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

export function MobilePersonPicker({
  people,
  activeId,
  selfId,
  onSelect,
  onAdd,
  portfolioByPerson,
  ownIds,
}: {
  people: Person[]
  activeId: string | null
  selfId?: string
  onSelect: (id: string) => void
  onAdd?: (name: string) => void | Promise<void>
  portfolioByPerson: Map<string, Portfolio>
  ownIds?: ReadonlySet<string>
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState(false)
  const selectable = ownIds ? people.filter((person) => ownIds.has(person.id)) : people
  const ordered = [
    ...selectable.filter((person) => person.id === selfId),
    ...selectable.filter((person) => person.id !== selfId),
  ]
  const active = selectable.find((person) => person.id === activeId)
  const canReturn = selfId && activeId !== selfId && selectable.some((person) => person.id === selfId)

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return
      setOpen(next)
      if (next) setAdding(false)
    }}>
      <div className="flex min-w-0 items-center gap-2">
        <DialogTrigger
          aria-label={`Picking for ${active?.name ?? 'no one'}. Choose a person`}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-control bg-background px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          {active ? <PersonAvatar name={active.name} color={active.color} className="shrink-0" /> : null}
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Picking for</span>
            <span className="block truncate text-sm font-bold" aria-live="polite">{active?.name ?? 'Choose a person'}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatUsd(active ? portfolioByPerson.get(active.id)?.totalUsd ?? 0 : 0)}
          </span>
          <RiArrowDownSLine className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </DialogTrigger>
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
          <DialogTitle>{adding ? 'Add someone to the table' : 'Choose a person'}</DialogTitle>
          <DialogDescription>
            {adding ? 'Pick their items from this phone.' : 'Who are you picking items for?'}
          </DialogDescription>
        </DialogHeader>
        {adding && onAdd ? (
          <NameEntryForm
            submitLabel="Add person"
            pendingLabel="Adding…"
            onCancel={() => setAdding(false)}
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
        ) : (
          <>
            <div className="max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain">
              {ordered.map((person) => (
                <button
                  key={person.id}
                  type="button"
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
              <Button variant="outline" className="min-h-12 w-full" onClick={() => setAdding(true)}>
                <RiUserAddLine aria-hidden /> Add person
              </Button>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
