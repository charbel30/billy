import type { ComponentType, ReactNode } from 'react'
import { motion } from 'motion/react'
import { fadeRise } from '~/lib/animations'
import { cn } from '~/lib/utils'

// Standard empty-state block: muted icon disc + title + optional hint/action.
// Use for "nothing here yet" moments (no scans, nothing claimed, link not open).
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <motion.div
      {...fadeRise}
      className={cn(
        'flex flex-col items-center gap-2 px-4 py-8 text-center',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </motion.div>
  )
}
