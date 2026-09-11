import { cloneElement, isValidElement, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '~/lib/utils'

/** Padding reserved for the dock until it reports its measured height. */
const DOCK_HEIGHT_FALLBACK = 240

/**
 * The frame every bill screen renders: header, one notice slot, the main
 * column, an optional desktop aside, and the floating dock. It owns the
 * `--dock-h` bottom padding so content always scrolls clear of the dock.
 */
export function BillScreen({
  header,
  notice,
  children,
  aside,
  dock,
  width = 'wide',
}: {
  /** A `<WorkspaceHeader/>`. */
  header: ReactNode
  /** The ONE notice slot (read-only, finalized lock, conflicts, validation). */
  notice?: ReactNode
  /** Main column. */
  children: ReactNode
  /** Desktop-only panel; the component itself carries `hidden lg:…`. */
  aside?: ReactNode
  /** A `<Dock/>` (or a wrapper forwarding `onCollapsedHeightChange`). */
  dock?: ReactNode
  /** `wide` = max-w-7xl with an aside column; `narrow` = max-w-md single column. */
  width?: 'wide' | 'narrow'
}) {
  const [measuredDockHeight, setMeasuredDockHeight] = useState<number | null>(
    null,
  )
  const dockHeight = dock ? (measuredDockHeight ?? DOCK_HEIGHT_FALLBACK) : 0

  // The dock measures itself; clone it so the page never has to thread the
  // height callback through every screen.
  const dockNode = isValidElement<{
    onCollapsedHeightChange?: (px: number) => void
  }>(dock)
    ? cloneElement(dock, { onCollapsedHeightChange: setMeasuredDockHeight })
    : dock

  const wide = width === 'wide'

  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-[calc(var(--dock-h)+1.5rem)] pt-2 sm:px-6 lg:pb-10 lg:pt-4',
        wide ? 'max-w-7xl lg:px-10' : 'max-w-md',
      )}
      style={{ '--dock-h': `${dockHeight}px` } as CSSProperties}
    >
      <div className="mb-3 lg:mb-5">{header}</div>

      <div
        className={cn(
          wide && 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start',
        )}
      >
        <div className="min-w-0 space-y-4">
          {notice ? <div className="space-y-3">{notice}</div> : null}
          {children}
        </div>
        {aside}
      </div>

      {dockNode}
    </div>
  )
}
