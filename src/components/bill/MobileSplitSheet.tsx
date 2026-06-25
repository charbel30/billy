import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiArrowUpSLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/split'
import { personClaimedLines } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { PersonRail } from './PersonRail'
import { PortfolioReceipt } from './PortfolioReceipt'

// The mobile bottom dock. Collapsed: the participant bar + actions. Drag the
// handle up (or tap it) to expand into a sheet with every person's claimed-item
// breakdown + the grand total — replacing the old always-on "Live totals".
export function MobileSplitSheet({
  people,
  breakdownPeople,
  activeId,
  onSelect,
  onAdd,
  portfolioByPerson,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  grandLbp,
  panelExtra,
  actionSlot,
  addPlaceholder,
}: {
  people: Person[]
  breakdownPeople: Person[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd?: (name: string) => void
  portfolioByPerson: Map<string, Portfolio>
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  grandLbp: number
  panelExtra?: ReactNode
  actionSlot?: ReactNode
  addPlaceholder?: string
}) {
  const [expanded, setExpanded] = useState(false)
  // Motion fires a synthetic click after a drag; this guard keeps a drag-release
  // from also toggling via onClick.
  const draggedRef = useRef(false)

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-4 pt-8 lg:hidden">
      <div className="mx-auto max-w-md overflow-hidden rounded-[2rem] bg-muted/95 shadow-[0_-18px_54px_rgba(0,0,0,0.10)] ring-1 ring-border/60 backdrop-blur-xl">
        {/* Grab handle — drag up/down to snap, or tap to toggle */}
        <motion.div
          drag="y"
          dragDirectionLock
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.35}
          onClick={() => {
            if (draggedRef.current) return
            setExpanded((v) => !v)
          }}
          onDragStart={() => {
            draggedRef.current = true
          }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -40 || info.velocity.y < -300) setExpanded(true)
            else if (info.offset.y > 40 || info.velocity.y > 300)
              setExpanded(false)
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
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              className="inline-flex"
            >
              <RiArrowUpSLine className="size-3.5" />
            </motion.span>
            {expanded ? 'Hide breakdown' : "Everyone's split"}
          </span>
        </motion.div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="sheet"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[52vh] space-y-3 overflow-y-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {breakdownPeople.map((p) => {
                  const portfolio = portfolioByPerson.get(p.id)
                  if (!portfolio) return null
                  return (
                    <PortfolioReceipt
                      key={p.id}
                      portfolio={portfolio}
                      lines={personClaimedLines(p.id, lineItems, claims)}
                      rate={rate}
                      serviceChargeOn={serviceChargeOn}
                    />
                  )
                })}

                <div className="flex items-center justify-between rounded-3xl bg-background/70 px-4 py-3 ring-1 ring-border/40">
                  <span className="font-bold text-muted-foreground">
                    Grand total
                  </span>
                  <div className="text-right">
                    <span className="block text-lg font-black tracking-tight text-primary tabular-nums">
                      {formatUsd(toUsd(grandLbp, rate))}
                    </span>
                    <span className="block text-xs font-semibold text-muted-foreground tabular-nums">
                      {formatLbp(grandLbp)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="space-y-2.5 p-3 pt-2">
          {panelExtra ? <div>{panelExtra}</div> : null}
          <PersonRail
            variant="bar"
            people={people}
            activeId={activeId}
            onSelect={onSelect}
            onAdd={onAdd}
            portfolioByPerson={portfolioByPerson}
            addPlaceholder={addPlaceholder}
          />
          {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
