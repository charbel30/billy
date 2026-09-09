import { useRef } from 'react'
import { motion } from 'motion/react'
import { RiArrowUpSLine, RiCheckboxCircleFill } from '@remixicon/react'
import { formatUsd, toUsd } from '~/lib/money'
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
    <motion.button
      type="button"
      aria-expanded={expanded}
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
      aria-label={expanded ? 'Hide breakdown' : "Show everyone's split"}
      className="flex w-full min-h-11 touch-none rounded-t-card focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring cursor-grab flex-col items-center gap-1.5 px-4 pt-3 pb-2 active:cursor-grabbing"
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
          <span className="font-receipt">
            <AnimatedAmount
              value={toUsd(remainingLbp, rate)}
              format={formatUsd}
            />{' '}
            left · {itemsClaimed} of {itemsTotal} items
          </span>
        )}
      </span>
      <span className="block h-1 w-full max-w-48 overflow-hidden rounded-full bg-primary/10">
        {/* scaleX, not width — width springs re-layout on every frame. */}
        <motion.span
          className={
            done
              ? 'block h-full w-full origin-left rounded-full bg-success rtl:origin-right'
              : 'block h-full w-full origin-left rounded-full bg-primary rtl:origin-right'
          }
          animate={{ scaleX: claimedPct / 100 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </span>
    </motion.button>
  )
}
