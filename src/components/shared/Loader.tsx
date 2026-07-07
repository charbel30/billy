import { cn } from '~/lib/utils'

const SIZE = {
  sm: 'size-5 border-2',
  md: 'size-8 border-[3px]',
  lg: 'size-12 border-4',
} as const

// Token-based spinner. Fills its container and centers itself; pass `label`
// for a short caption under the ring (e.g. "Loading bill…").
export function Loader({
  size = 'lg',
  label,
  className,
}: {
  size?: keyof typeof SIZE
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex h-full grow', className)}>
      <div className="m-auto flex flex-col items-center gap-3">
        <div
          aria-label={label ?? 'Loading'}
          role="status"
          className={cn(
            'animate-spin rounded-full border-muted border-t-primary-strong',
            SIZE[size],
          )}
        />
        {label ? (
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        ) : null}
      </div>
    </div>
  )
}
