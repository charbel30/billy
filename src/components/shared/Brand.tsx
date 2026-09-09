import { brand } from '~/lib/ui/brand'
import { cn } from '~/lib/utils'

export function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={cn('shrink-0', className)}>
      <g className="brand-character" transform={brand.markTransform}>
        <path fillRule="evenodd" d={brand.receipt} />
      </g>
    </svg>
  )
}

/** Keep the visible custom lettering and a readable name for assistive technology. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="brand-tile grid size-10 shrink-0 place-items-center rounded-[13px]">
        <BrandSymbol className="size-9" />
      </span>
      <span className="sr-only">{brand.name}</span>
      <svg viewBox={brand.wordmarkViewBox} fill="currentColor" aria-hidden="true" className="h-10 w-[102px] shrink-0">
        {brand.wordmark.map((d, index) => <path key={index} d={d} fillRule="evenodd" />)}
      </svg>
    </span>
  )
}
