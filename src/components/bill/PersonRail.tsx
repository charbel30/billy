import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiAddLine, RiCloseLine } from '@remixicon/react'
import type { Person } from '~/lib/types'
import { cn } from '~/lib/utils'

// People row for splitting. Pick a person to make them "active", then pull units
// onto them in the ClaimList. The bill starts with "self" (ui-flow-vision.md).
export function PersonRail({
  people,
  activeId,
  onSelect,
  onAdd,
  onRemove,
}: {
  people: Person[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AnimatePresence initial={false}>
        {people.map((p) => {
          const active = p.id === activeId
          return (
            <motion.button
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
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
              {people.length > 1 && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(p.id)
                  }}
                  className="opacity-60 hover:opacity-100"
                >
                  <RiCloseLine className="size-3.5" />
                </span>
              )}
            </motion.button>
          )
        })}
      </AnimatePresence>

      <div className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add person"
          className="w-24 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Add person"
          className="text-muted-foreground hover:text-foreground"
        >
          <RiAddLine className="size-4" />
        </button>
      </div>
    </div>
  )
}
