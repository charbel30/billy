import { useId } from 'react'
import { brand } from '~/lib/ui/brand'
import { cn } from '~/lib/utils'

export function BrandSymbol({ className }: { className?: string }) {
  const cutoutId = useId()
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={cn('shrink-0', className)}>
      <defs>
        <mask id={cutoutId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64" style={{ maskType: 'luminance' }}>
          <rect width="64" height="64" fill="white" />
          <path d={brand.slit} transform={brand.slitInReceipt} fill="black" />
        </mask>
      </defs>
      <g transform={brand.markTransform}>
        <path d={brand.receipt} mask={`url(#${cutoutId})`} />
      </g>
    </svg>
  )
}

/** Keep the visible custom lettering and a readable name for assistive technology. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  const cutoutId = useId()
  return (
    <span className={cn('inline-flex items-center', compact ? 'gap-1.5' : 'gap-2.5', className)}>
      <span className={cn('brand-tile grid shrink-0 place-items-center', compact ? 'size-8 rounded-[10px]' : 'size-10 rounded-[13px]')}>
        <BrandSymbol className={compact ? 'size-7' : 'size-9'} />
      </span>
      <span className="sr-only">{brand.name}</span>
      <svg viewBox={brand.wordmarkViewBox} fill="currentColor" aria-hidden="true" className={cn('shrink-0', compact ? 'h-8 w-[76px]' : 'h-10 w-[102px]')}>
        <defs>
          <mask id={cutoutId} maskUnits="userSpaceOnUse" x="0" y="0" width="335" height="132" style={{ maskType: 'luminance' }}>
            <rect width="335" height="132" fill="white" />
            <path d={brand.slit} transform={brand.slitInO} fill="black" stroke="black" strokeWidth={brand.oGapStrokeWidth} strokeLinejoin="round" />
          </mask>
        </defs>
        <g mask={`url(#${cutoutId})`}>
          {brand.wordmark.map((d, index) => <path key={index} d={d} fillRule="evenodd" />)}
          <path d={brand.pTail} transform={brand.pTailTransform} />
        </g>
      </svg>
    </span>
  )
}
