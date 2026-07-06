import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiArrowUpSLine, RiCheckboxCircleFill } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/split'
import { personClaimedLines } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { AnimatedAmount } from './AnimatedAmount'
import { PersonAvatar } from './PersonAvatar'
import { PersonRail } from './PersonRail'
import { PortfolioReceipt } from './PortfolioReceipt'

// The mobile bottom dock. Collapsed: live claim progress + the participant bar
// (or, on a shared bill, just the active person + a "+N others" pill — guests
// claim their own items, so the full row is noise) + actions. Drag the handle
// up (or tap it) to expand into a sheet with every person's claimed-item
// breakdown, the grand total, and the tip control.
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
  tipPercent,
  grandLbp,
  shared = false,
  remainingLbp = 0,
  billTotalLbp = 0,
  itemsClaimed = 0,
  itemsTotal = 0,
  panelExtra,
  expandedExtra,
  actionSlot,
  addPlaceholder,
  onCollapsedHeightChange,
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
  tipPercent?: number | null
  grandLbp: number
  shared?: boolean
  remainingLbp?: number
  billTotalLbp?: number
  itemsClaimed?: number
  itemsTotal?: number
  panelExtra?: ReactNode
  expandedExtra?: ReactNode
  actionSlot?: ReactNode
  addPlaceholder?: string
  /** Reports the dock's COLLAPSED height so the page can pad the list past it. */
  onCollapsedHeightChange?: (px: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  // Motion fires a synthetic click after a drag; this guard keeps a drag-release
  // from also toggling via onClick.
  const draggedRef = useRef(false)

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

  const activePerson = people.find((p) => p.id === activeId) ?? null
  const othersCount = Math.max(0, people.length - 1)

  return (
    <div
      ref={wrapperRef}
      className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 lg:hidden"
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-[2rem] bg-muted/95 shadow-[0_-18px_54px_rgba(0,0,0,0.10)] ring-1 ring-border/60 backdrop-blur-xl">
        {/* Grab handle — drag up/down to snap, or tap to toggle. Carries the
            live progress readout so status is glanceable without expanding. */}
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
          <span
            className={
              done
                ? 'flex items-center gap-1 text-[11px] font-semibold text-emerald-700'
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
                <RiCheckboxCircleFill className="size-3.5 text-emerald-600" />
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
                done ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-primary'
              }
              animate={{ width: `${claimedPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
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
                      tipPercent={tipPercent}
                    />
                  )
                })}

                <div className="flex items-center justify-between rounded-3xl bg-background/70 px-4 py-3 ring-1 ring-border/40">
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
                    <span className="block text-lg font-black tracking-tight text-primary tabular-nums">
                      {formatUsd(toUsd(grandLbp, rate))}
                    </span>
                    <span className="block text-xs font-semibold text-muted-foreground tabular-nums">
                      {formatLbp(grandLbp)}
                    </span>
                  </div>
                </div>

                {expandedExtra ? (
                  <div className="rounded-3xl bg-background/70 px-4 py-3 ring-1 ring-border/40">
                    {expandedExtra}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="space-y-2.5 p-3 pt-2">
          {panelExtra ? <div>{panelExtra}</div> : null}
          <AnimatePresence initial={false} mode="popLayout">
            {shared && !expanded ? (
              // Shared bill, collapsed: guests claim their own items, so keep
              // just the active person + a summary pill that opens the sheet.
              <motion.div
                key="self-row"
                initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                className="flex items-center gap-2 py-0.5"
              >
                {activePerson ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    style={{ backgroundColor: activePerson.color }}
                    className="flex min-w-0 shrink items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
                  >
                    <PersonAvatar
                      name={activePerson.name}
                      color={activePerson.color}
                      size="md"
                    />
                    <span className="truncate whitespace-nowrap leading-none">
                      {activePerson.name}
                      <span className="ml-1.5 tabular-nums text-white/80">
                        {formatUsd(
                          portfolioByPerson.get(activePerson.id)?.totalUsd ?? 0,
                        )}
                      </span>
                    </span>
                  </button>
                ) : null}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setExpanded(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-2 text-xs font-semibold text-muted-foreground ring-1 ring-border/40 transition-colors hover:text-foreground"
                >
                  {othersCount > 0
                    ? `+${othersCount} other${othersCount === 1 ? '' : 's'} · `
                    : ''}
                  {done ? (
                    'all covered'
                  ) : (
                    <span className="tabular-nums">
                      {formatUsd(toUsd(remainingLbp, rate))} left
                    </span>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="full-rail"
                initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              >
                <PersonRail
                  variant="bar"
                  people={people}
                  activeId={activeId}
                  onSelect={onSelect}
                  onAdd={onAdd}
                  portfolioByPerson={portfolioByPerson}
                  addPlaceholder={addPlaceholder}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
