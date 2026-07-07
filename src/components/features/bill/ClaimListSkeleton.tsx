import { Skeleton } from '~/components/ui/skeleton'
import { ELEVATED_CARD } from '~/lib/bill/constants'
import { cn } from '~/lib/utils'

// Loading placeholder for the split workspace: mirrors the hero + item card
// layout (same radii/heights) so the real content lands without a jump.
export function ClaimListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pt-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-control" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-card lg:max-w-2xl" />
      <div className="space-y-3 lg:max-w-2xl">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('space-y-3 p-4', ELEVATED_CARD)}>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
