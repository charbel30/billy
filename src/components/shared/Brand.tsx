import { brand } from '~/lib/ui/brand'
import { cn } from '~/lib/utils'

export function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={cn('shrink-0', className)}>
      <g transform="rotate(-45 32 32)">
        <path className="brand-half-first" d={brand.topHalf} />
        <path className="brand-half-second" d={brand.bottomHalf} />
      </g>
    </svg>
  )
}

/** A wordmark is always visible; the abstract symbol never has to explain the name. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="brand-tile grid size-10 shrink-0 place-items-center rounded-[13px]">
        <BrandSymbol className="size-9" />
      </span>
      <span className="text-[23px] font-extrabold tracking-[-0.065em] leading-none">{brand.name}</span>
    </span>
  )
}
