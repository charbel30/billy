import { useState } from 'react'
import { RiAddLine, RiCheckLine, RiUserAddLine } from '@remixicon/react'
import { cn } from '~/lib/utils'

// Inline add-person control: a dashed button that expands into a name input
// (Enter/blur commits, Escape cancels). Bar = compact round pill for the
// mobile dock; panel = full-width row for the desktop aside.
export function AddPerson({
  onAdd,
  variant,
  label = 'Add person',
  placeholder = 'Add person',
}: {
  onAdd: (name: string) => void
  variant: 'panel' | 'bar'
  label?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
    setOpen(false)
  }

  if (!open) {
    if (variant === 'bar') {
      return (
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-dashed border-primary/30 text-primary-strong transition-[scale,background-color] hover:bg-primary/10 active:scale-[0.96]"
        >
          <RiUserAddLine className="size-5" />
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-control border-2 border-dashed border-primary/30 px-4 py-3 text-sm font-bold text-primary-strong transition-[scale,background-color] hover:bg-primary/10 active:scale-[0.96]"
      >
        <RiUserAddLine className="size-5" /> {label}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1',
        variant === 'bar' ? 'shrink-0' : 'rounded-control px-3 py-2',
      )}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setOpen(false)
        }}
        onBlur={() => (name.trim() ? submit() : setOpen(false))}
        placeholder={placeholder}
        className="w-28 bg-transparent text-sm outline-none"
      />
      <button
        type="button"
        onClick={submit}
        aria-label={label}
        className="grid size-9 shrink-0 place-items-center rounded-full text-primary-strong transition-[scale,color] hover:text-foreground active:scale-[0.96]"
      >
        {variant === 'bar' ? (
          <RiAddLine className="size-4" />
        ) : (
          <RiCheckLine className="size-4" />
        )}
      </button>
    </div>
  )
}
