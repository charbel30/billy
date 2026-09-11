import type { ReactNode } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { RiCloseLine } from '@remixicon/react'
import { cn } from '~/lib/utils'
import './dock.css'

/**
 * The modal sibling of `Dock`: same surface, opened on demand, one position,
 * dismissed by swipe, backdrop or escape. `responsive` turns it into a centred
 * dialog once there is room for one.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  responsive = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Bottom sheet below sm, centered dialog at sm and up. */
  responsive?: boolean
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="dock-sheet-backdrop fixed inset-0 z-50 bg-black/40 supports-backdrop-filter:backdrop-blur-sm" />
        <Drawer.Viewport
          className={cn(
            'dock-sheet-viewport fixed inset-0 z-50 flex justify-center',
            responsive ? 'items-end sm:items-center' : 'items-end',
          )}
        >
          <Drawer.Popup
            data-responsive={responsive}
            className="dock-sheet-popup surface-dock relative flex max-h-full w-full max-w-[var(--dock-max-width)] flex-col gap-4 p-5 text-foreground outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Drawer.Title className="text-lg font-extrabold tracking-tight">
                  {title}
                </Drawer.Title>
                {description ? (
                  <Drawer.Description className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close
                aria-label="Close"
                className="-me-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <RiCloseLine className="size-5" aria-hidden />
              </Drawer.Close>
            </div>
            <Drawer.Content className="min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
