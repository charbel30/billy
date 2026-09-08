import { cn } from '~/lib/utils'
import { BrandSymbol } from '~/components/shared/Brand'

const SIZE = {
  sm: 'size-6',
  md: 'size-10',
  lg: 'size-14',
} as const

// The split mark breathes only while loading; reduced motion keeps it static.
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
        <BrandSymbol className={cn('brand-loading text-primary-strong', SIZE[size])} />
        <p role="status" className={cn('text-sm font-medium text-muted-foreground', !label && 'sr-only')}>
          {label ?? 'Loading'}
        </p>
      </div>
    </div>
  )
}
