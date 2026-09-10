import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { personClaimedLines, formatLbp, formatUsd, toUsd } from '~/lib/money'
import { sheetSpring } from '~/lib/ui'
import { MobilePersonPicker } from '../people/MobilePersonPicker'
import { PortfolioReceipt } from '../receipt'
import { SplitSheetHandle } from './SplitSheetHandle'

// Compact mobile dock: assignment picker and actions stay visible; expand
// the progress handle to see everyone's breakdown and the tip control.
export function MobileSplitSheet({
  people,
  breakdownPeople,
  activeId,
  selfId,
  onSelect,
  onAdd,
  portfolioByPerson,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
  grandLbp,
  remainingLbp = 0,
  billTotalLbp = 0,
  itemsClaimed = 0,
  itemsTotal = 0,
  panelExtra,
  expandedExtra,
  actionSlot,
  onCollapsedHeightChange,
  ownIds,
}: {
  people: Person[]
  breakdownPeople: Person[]
  activeId: string | null
  selfId?: string
  onSelect: (id: string) => void
  onAdd?: (name: string) => void | Promise<void>
  portfolioByPerson: Map<string, Portfolio>
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
  grandLbp: number
  remainingLbp?: number
  billTotalLbp?: number
  itemsClaimed?: number
  itemsTotal?: number
  panelExtra?: ReactNode
  expandedExtra?: ReactNode
  actionSlot?: ReactNode
  /** Reports the dock's COLLAPSED height so the page can pad the list past it. */
  onCollapsedHeightChange?: (px: number) => void
  /** Only these people can be selected; all breakdowns remain visible. */
  ownIds?: ReadonlySet<string>
}) {
  const [expanded, setExpanded] = useState(false)

  const done = remainingLbp <= 0.5
  const claimedPct =
    billTotalLbp > 0
      ? Math.min(100, ((billTotalLbp - remainingLbp) / billTotalLbp) * 100)
      : 0

  // Report the collapsed dock height so the item list can pad past it. The
  // expanded sheet must never inflate the page padding, so measurements taken
  // while expanded are dropped (the last collapsed value stays in force).
  const wrapperRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  useEffect(() => {
    const el = wrapperRef.current
    if (!el || !onCollapsedHeightChange) return
    const report = () => {
      if (!expandedRef.current) {
        onCollapsedHeightChange(el.getBoundingClientRect().height)
      }
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [onCollapsedHeightChange])

  // Expanded sheet: your own people's breakdown cards first, everyone else after.
  const orderedBreakdownPeople = ownIds
    ? [
        ...breakdownPeople.filter((p) => ownIds.has(p.id)),
        ...breakdownPeople.filter((p) => !ownIds.has(p.id)),
      ]
    : breakdownPeople

  return (
    <div
      ref={wrapperRef}
      className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 lg:hidden"
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-card bg-muted/95 shadow-dock ring-1 ring-border/60 backdrop-blur-xl">
        <SplitSheetHandle
          expanded={expanded}
          onExpandedChange={setExpanded}
          done={done}
          claimedPct={claimedPct}
          remainingLbp={remainingLbp}
          rate={rate}
          itemsClaimed={itemsClaimed}
          itemsTotal={itemsTotal}
        />

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="sheet"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={sheetSpring}
              className="overflow-hidden"
            >
              {/* Fade masks stand in for hidden scrollbars as the scroll affordance. */}
              <div className="max-h-[52dvh] space-y-3 overflow-y-auto overscroll-contain px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-16px),transparent)]">
                {orderedBreakdownPeople.map((p) => {
                  const portfolio = portfolioByPerson.get(p.id)
                  if (!portfolio) return null
                  return (
                    <PortfolioReceipt
                      key={p.id}
                      portfolio={portfolio}
                      lines={personClaimedLines(p.id, lineItems, claims)}
                      rate={rate}
                      serviceChargeOn={serviceChargeOn}
                      tipPercent={tipPercent}
                    />
                  )
                })}

                <div className="flex items-center justify-between rounded-control bg-background/70 px-4 py-3 ring-1 ring-border/40">
                  <div>
                    <span className="block font-bold text-muted-foreground">
                      Grand total
                    </span>
                    {tipPercent && grandLbp > 0 ? (
                      <span className="block text-[11px] font-semibold text-muted-foreground/80">
                        incl. {tipPercent}% tip
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className="block font-receipt text-lg font-bold tracking-tight text-primary-strong">
                      {formatUsd(toUsd(grandLbp, rate))}
                    </span>
                    <span className="block font-receipt text-xs font-semibold text-muted-foreground">
                      {formatLbp(grandLbp)}
                    </span>
                  </div>
                </div>

                {expandedExtra ? (
                  <div className="rounded-control bg-background/70 px-4 py-3 ring-1 ring-border/40">
                    {expandedExtra}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="space-y-2.5 p-3 pt-2">
          {panelExtra ? <div>{panelExtra}</div> : null}
          <MobilePersonPicker
            people={people}
            activeId={activeId}
            selfId={selfId}
            onSelect={onSelect}
            onAdd={onAdd}
            portfolioByPerson={portfolioByPerson}
            ownIds={ownIds}
            lineItems={lineItems}
            claims={claims}
            rate={rate}
            serviceChargeOn={serviceChargeOn}
            tipPercent={tipPercent}
          />
          {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
