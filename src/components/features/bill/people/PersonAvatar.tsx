import { cn } from '~/lib/utils'
import { personColorValue } from '~/lib/bill/constants'

// A small circular initials avatar filled with the person's color. Used in the
// item cards (assignee stacks), the person panel, and the summary receipts.
const SIZE = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const

function initial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '?'
}

export function PersonAvatar({
  name,
  color,
  size = 'md',
  className,
  title,
}: {
  name: string
  color?: string | null
  size?: keyof typeof SIZE
  className?: string
  title?: string
}) {
  return (
    <span
      title={title ?? name}
      aria-label={name}
      style={{ backgroundColor: personColorValue(color ?? undefined) }}
      className={cn(
        'inline-grid place-items-center rounded-full font-bold text-white ring-2 ring-background',
        SIZE[size],
        className,
      )}
    >
      {initial(name)}
    </span>
  )
}
