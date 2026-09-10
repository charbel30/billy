import { useId, useRef, useState } from 'react'
import { RiArrowRightLine, RiLoader4Line } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

export function NameEntryForm({
  onSubmit, submitLabel, pendingLabel, disabled = false, joining = false, onCancel,
}: {
  onSubmit: (name: string) => void | Promise<void>
  submitLabel: string
  pendingLabel: string
  disabled?: boolean
  joining?: boolean
  onCancel?: () => void
}) {
  const id = useId()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)

  return (
    <form className="space-y-4" aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault()
      if (!name.trim() || disabled || submitting.current) return
      submitting.current = true
      setPending(true)
      setError(null)
      try {
        await onSubmit(name.trim())
        setName('')
      } catch {
        setError(joining ? 'Could not join the table. Your name is still here — try again.' : 'Could not add this person. Try again.')
      } finally {
        submitting.current = false
        setPending(false)
      }
    }}>
      <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-bold">{joining ? 'Your name' : 'Their name'}</label>
        <Input id={id} name="name" autoComplete={joining ? 'given-name' : 'off'} autoCapitalize="words" enterKeyHint="done"
          placeholder={joining ? 'e.g. Maya' : 'e.g. Karim'} required
          value={name} disabled={pending} onChange={(event) => setName(event.target.value)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          className="h-12 text-base" />
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{joining ? 'Use a name your table will recognize. You can add someone with you after joining.' : 'You’ll switch to this person to pick their items.'}</p>
      </div>
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        {onCancel ? <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" size="lg" className="min-h-12 flex-1" disabled={disabled || pending || !name.trim()}>
          {pending ? <RiLoader4Line className="animate-spin" aria-hidden /> : null}
          {pending ? pendingLabel : submitLabel}
          {!pending ? <RiArrowRightLine aria-hidden /> : null}
        </Button>
      </div>
    </form>
  )
}
