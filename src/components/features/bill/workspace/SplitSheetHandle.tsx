import type { Ref } from 'react'
import { RiArrowUpSLine } from '@remixicon/react'
import { formatUsd, toUsd } from '~/lib/money'

// Drawer.Viewport handles swipes on the persistent sheet; this button expands it.
export function SplitSheetHandle({ ref, onExpand, itemsClaimed, itemsTotal, remainingLbp, rate }: {
  ref?: Ref<HTMLButtonElement>
  onExpand: () => void
  itemsClaimed: number
  itemsTotal: number
  remainingLbp: number
  rate?: number | null
}) {
  return (
      <button type="button" ref={ref} onClick={onExpand}
        aria-label={`View table totals, ${itemsClaimed} of ${itemsTotal} items assigned`}
        className="flex min-h-16 w-full flex-col items-center gap-2 rounded-t-card px-4 pb-2 pt-3 text-left transition-colors hover:bg-background/30 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-foreground/20" />
        <span className="flex w-full items-center justify-between gap-3">
          <span className="text-sm font-semibold">View table totals</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {remainingLbp > 0.5 ? `${formatUsd(toUsd(remainingLbp, rate))} left` : 'All assigned'}
            <RiArrowUpSLine className="size-4" aria-hidden />
          </span>
        </span>
      </button>
  )
}
