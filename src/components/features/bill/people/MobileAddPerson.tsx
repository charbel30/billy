import { useId, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { RiAddLine, RiCloseLine, RiLoader4Line } from '@remixicon/react'
import { Button } from '~/components/ui/button'

/** One surface expands from the add button into the full-width name form. */
export function MobileAddPerson({ onAdd, actionSlot, editing, onEditingChange }: {
  onAdd: (name: string) => void | Promise<void>
  actionSlot?: ReactNode
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  const id = useId()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()

  function close() {
    if (submitting.current) return
    setName('')
    setError(null)
    flushSync(() => onEditingChange(false))
    triggerRef.current?.focus({ preventScroll: true })
  }

  return (
    <div data-base-ui-swipe-ignore>
      <div className="relative min-h-12">
        <div inert={editing} aria-hidden={editing} className="absolute right-0 top-0 w-[calc(50%-0.25rem)] transition-opacity duration-150 motion-reduce:transition-none [&_button]:min-h-12 [&_button]:w-full" style={{ opacity: editing ? 0 : 1 }}>
          {actionSlot}
        </div>
        <motion.div initial={false} animate={{ width: editing || !actionSlot ? '100%' : 'calc(50% - 0.25rem)' }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.28, bounce: 0 }}
          className="relative z-10 min-h-12 overflow-hidden rounded-full bg-background ring-1 ring-inset ring-border/60 focus-within:ring-2 focus-within:ring-ring">
          <button ref={triggerRef} type="button" inert={editing} aria-hidden={editing} onClick={() => {
            flushSync(() => onEditingChange(true))
            // Focus in the initiating tap so mobile browsers open the keyboard.
            inputRef.current?.focus({ preventScroll: true })
          }} className="absolute inset-0 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-opacity duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none" style={{ opacity: editing ? 0 : 1 }}>
            <RiAddLine className="size-4" aria-hidden />Add person
          </button>
          <form inert={!editing} aria-hidden={!editing} aria-busy={pending} className="flex min-h-12 items-center transition-opacity duration-150 motion-reduce:transition-none" style={{ opacity: editing ? 1 : 0 }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
            }}
            onSubmit={async (event) => {
              event.preventDefault()
              if (!name.trim() || submitting.current) return
              submitting.current = true
              setPending(true)
              setError(null)
              try {
                await onAdd(name.trim())
                submitting.current = false
                close()
              } catch {
                setError('Could not add this person. Your name is still here — try again.')
              } finally {
                submitting.current = false
                setPending(false)
              }
            }}>
            <button type="button" aria-label="Cancel adding person" disabled={pending} onClick={close} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
              <RiCloseLine className="size-4" aria-hidden />
            </button>
            <label htmlFor={id} className="sr-only">Person’s name</label>
            <input ref={inputRef} id={id} name="name" autoComplete="off" autoCapitalize="words" enterKeyHint="done" placeholder="Person’s name" required
              value={name} readOnly={pending} onChange={(event) => setName(event.target.value)} aria-describedby={error ? `${id}-error` : undefined}
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
            <Button type="submit" disabled={pending || !name.trim()} className="mr-1 min-h-11 min-w-11 px-3">
              {pending ? <RiLoader4Line className="animate-spin" aria-hidden /> : null}
              {pending ? 'Adding…' : 'Add'}
            </Button>
          </form>
        </motion.div>
      </div>
      {error && editing ? <p id={`${id}-error`} role="alert" className="mt-2 px-2 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
