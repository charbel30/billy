import { useEffect, useRef, useState } from 'react'
import { cn } from '~/lib/utils'

// Inline editable field that commits on blur (Enter commits, Escape cancels).
// Rests almost-invisible inside its card, shows an input affordance on hover,
// and flashes a brief success wash after a commit lands.
export function BlurCommitInput({
  value,
  onCommit,
  numeric,
  placeholder,
  className,
  align = 'left',
  readOnly = false,
}: {
  value: string | number | null | undefined
  onCommit: (raw: string) => void
  numeric?: boolean
  placeholder?: string
  className?: string
  align?: 'left' | 'center' | 'right'
  readOnly?: boolean
}) {
  const initial = value == null ? '' : String(value)
  const [draft, setDraft] = useState(initial)
  const [flash, setFlash] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => setDraft(initial), [initial])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 600)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <input
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={placeholder}
      value={draft}
      readOnly={readOnly}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          setDraft(initial)
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        if (readOnly) return
        if (cancelled.current) {
          cancelled.current = false
          return
        }
        if (draft !== initial) {
          onCommit(draft)
          setFlash(true)
        }
      }}
      className={cn(
        'rounded-control bg-transparent px-1 outline-none transition-colors duration-300',
        'hover:bg-muted/50 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/50',
        readOnly &&
          'cursor-default hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0',
        numeric && 'font-receipt',
        flash && 'bg-success-subtle duration-0',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
    />
  )
}
