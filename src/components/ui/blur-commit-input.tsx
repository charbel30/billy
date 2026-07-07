import { useEffect, useState } from 'react'
import { cn } from '~/lib/utils'

export function BlurCommitInput({
  value,
  onCommit,
  numeric,
  placeholder,
  className,
  align = 'left',
}: {
  value: string | number | null | undefined
  onCommit: (raw: string) => void
  numeric?: boolean
  placeholder?: string
  className?: string
  align?: 'left' | 'center' | 'right'
}) {
  const initial = value == null ? '' : String(value)
  const [draft, setDraft] = useState(initial)

  useEffect(() => setDraft(initial), [initial])

  return (
    <input
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== initial && onCommit(draft)}
      className={cn(
        'bg-transparent outline-none focus:bg-muted/60 rounded px-1',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
    />
  )
}
