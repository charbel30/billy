import { useRef } from 'react'
import { motion } from 'motion/react'
import { RiArrowUpSLine, RiCheckboxCircleFill } from '@remixicon/react'
import { formatUsd, toUsd } from '~/lib/currency'
import { AnimatedAmount } from '~/components/ui/animated-amount'

// The mobile dock's grab handle — drag up/down to snap, or tap to toggle.
// Carries the live progress readout so status is glanceable without expanding.
export function SplitSheetHandle({
  expanded,
  onExpandedChange,
  done,
  claimedPct,
  remainingLbp,
  rate,
  itemsClaimed,
  itemsTotal,
}: {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  done: boolean
  claimedPct: number
  remainingLbp: number
  rate?: number | null
  itemsClaimed: number
  itemsTotal: number
}) {
  // Motion fires a synthetic click after a drag; this guard keeps a drag-release
  // from also toggling via onClick.
  const draggedRef = useRef(false)

  return (
    <motion.div
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.35}
      onClick={() => {
        if (draggedRef.current) return
        onExpandedChange(!expanded)
      }}
      onDragStart={() => {
        draggedRef.current = true
      }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -40 || info.velocity.y < -300) onExpandedChange(true)
        else if (info.offset.y > 40 || info.velocity.y > 300)
          onExpandedChange(false)
        // Reset after the synthetic click has been swallowed.
        setTimeout(() => {
          draggedRef.current = false
        }, 0)
      }}
      role="button"
      aria-label={expanded ? 'Hide breakdown' : "Show everyone's split"}
      className="flex touch-none cursor-grab flex-col items-center gap-1.5 px-4 pt-3 pb-2 active:cursor-grabbing"
    >
      <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
      <span
        className={
          done
            ? 'flex items-center gap-1 text-[11px] font-semibold text-success-subtle-foreground'
            : 'flex items-center gap-1 text-[11px] font-semibold text-muted-foreground'
        }
      >
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          className="inline-flex"
        >
          <RiArrowUpSLine className="size-3.5" />
        </motion.span>
        {done ? (
          <>
            Everyone's covered
            <RiCheckboxCircleFill className="size-3.5 text-success" />
          </>
        ) : (
          <span className="tabular-nums">
            <AnimatedAmount
              value={toUsd(remainingLbp, rate)}
              format={formatUsd}
            />{' '}
            left · {itemsClaimed} of {itemsTotal} items
          </span>
        )}
      </span>
      <div className="h-1 w-full max-w-48 overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className={
            done ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-primary'
          }
          animate={{ width: `${claimedPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </motion.div>
  )
}
