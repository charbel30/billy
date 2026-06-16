import { useState } from 'react'
import { RiAddLine, RiCloseLine } from '@remixicon/react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import type { Doc, Id } from 'convex/_generated/dataModel'

// People + colors (spec §8.2 PersonChips). Add by name; remove with the ×.
export function PersonChips({
  people,
  onAdd,
  onRemove,
}: {
  people: Doc<'people'>[]
  onAdd: (name: string) => void
  onRemove: (id: Id<'people'>) => void
}) {
  const [name, setName] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <span
            key={p._id}
            className="inline-flex items-center gap-1.5 rounded-3xl py-1 pl-3 pr-1 text-sm font-medium text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.name}
            <button
              type="button"
              onClick={() => onRemove(p._id)}
              className="rounded-full p-0.5 hover:bg-black/20"
              aria-label={`Remove ${p.name}`}
            >
              <RiCloseLine className="size-3.5" />
            </button>
          </span>
        ))}
        {people.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No one yet — add people to split with.
          </span>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a person"
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Add person">
          <RiAddLine />
        </Button>
      </form>
    </div>
  )
}
