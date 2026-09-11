import { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { personClaimedLines, formatLbp, formatUsd, toUsd } from '~/lib/money'
import { MobilePersonPicker } from '../people/MobilePersonPicker'
import { MobileAddPerson } from '../people/MobileAddPerson'
import { Accordion } from '@base-ui/react/accordion'
import { RiArrowDownSLine, RiCloseLine } from '@remixicon/react'
import { PersonAvatar } from '../people/PersonAvatar'
import { formatUnits } from '~/lib/format'
import { SplitSheetHandle } from './SplitSheetHandle'
import './table-totals-drawer.css'

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect

// One persistent sheet with a compact snap point and an expanded overview.
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
  itemsClaimed = 0,
  itemsTotal = 0,
  panelExtra,
  expandedExtra,
  actionSlot,
  onCollapsedHeightChange,
  ownIds,
  expanded,
  onExpandedChange: setExpanded,
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
  itemsClaimed?: number
  itemsTotal?: number
  panelExtra?: ReactNode
  expandedExtra?: ReactNode
  actionSlot?: ReactNode
  /** Reports the dock's COLLAPSED height so the page can pad the list past it. */
  onCollapsedHeightChange?: (px: number) => void
  /** Only these people can be selected; all breakdowns remain visible. */
  ownIds?: ReadonlySet<string>
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const [editingPerson, setEditingPerson] = useState(false)
  const [positionReady, setPositionReady] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [compactHeight, setCompactHeight] = useState(200)
  const [popupElement, setPopupElement] = useState<HTMLDivElement | null>(null)
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null)
  const [compactElement, setCompactElement] = useState<HTMLDivElement | null>(null)
  const attachPopup = useCallback((element: HTMLDivElement | null) => {
    setPositionReady(false)
    setPopupElement(element)
  }, [])

  // On mobile the keyboard can shrink only the visual viewport. Lift the
  // collapsed dock by that inset so the inline name form stays above it.
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || !viewportElement || !editingPerson || expanded) return
    const sync = () => viewportElement.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`)
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
      viewportElement.style.removeProperty('--keyboard-inset')
    }
  }, [editingPerson, expanded, viewportElement])
  const expandRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const collapsedPoint = `${compactHeight}px`
  const snapPoints = useMemo(() => [collapsedPoint, 0.85], [collapsedPoint])

  // Mount and measure the mobile dock before the receipt's first paint.
  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const sync = () => {
      setMobile(media.matches)
      if (!media.matches) setExpanded(false)
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [setExpanded])

  useIsomorphicLayoutEffect(() => {
    const el = compactElement
    if (!el) return
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height === 0) return
      setCompactHeight(height)
      onCollapsedHeightChange?.(height + 16)
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [compactElement, onCollapsedHeightChange])

  // Follow the library's actual sheet position, including touch movement and
  // snap settling, so the two views crossfade throughout the same gesture.
  useIsomorphicLayoutEffect(() => {
    const popup = popupElement
    const viewport = viewportElement
    if (!popup || !viewport || !compactElement) return
    let frame = 0
    let settleUntil = 0
    const paint = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(popup).transform)
      // Read the measured height, not the initial snap-point estimate: accepting
      // that estimate would reveal the dock before the real offset is applied.
      const travel = popup.clientHeight - Math.ceil(compactElement.getBoundingClientRect().height)
      if (travel > 0 && Math.abs(matrix.m42 - travel) < 2) setPositionReady(true)
      const progress = travel > 0 ? Math.max(0, Math.min(1, 1 - matrix.m42 / travel)) : 0
      viewport.style.setProperty('--sheet-progress', String(progress))
      frame = performance.now() < settleUntil ? requestAnimationFrame(paint) : 0
    }
    const follow = () => {
      settleUntil = performance.now() + 300
      if (!frame) paint()
    }
    const observer = new MutationObserver(follow)
    observer.observe(popup, { attributes: true, attributeFilter: ['style', 'data-swiping', 'data-overview'] })
    follow()
    window.addEventListener('resize', follow)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', follow)
      cancelAnimationFrame(frame)
    }
  }, [popupElement, viewportElement, compactElement, compactHeight])

  useEffect(() => {
    if (expanded) collapseRef.current?.focus({ preventScroll: true })
  }, [expanded])

  function collapse() {
    if (!expanded) return
    setExpanded(false)
    requestAnimationFrame(() => expandRef.current?.focus({ preventScroll: true }))
  }

  const orderedBreakdownPeople = [
    ...breakdownPeople.filter((person) => person.id === selfId),
    ...breakdownPeople.filter((person) => person.id !== selfId && (!ownIds || ownIds.has(person.id))),
    ...breakdownPeople.filter((person) => person.id !== selfId && ownIds && !ownIds.has(person.id)),
  ]

  return (
    <Drawer.Root
      open={mobile}
      modal={expanded}
      snapPoints={snapPoints}
      snapPoint={expanded ? 0.85 : collapsedPoint}
      snapToSequentialPoints
      onSnapPointChange={(point) => {
        if (point === 0.85) setExpanded(true)
        else collapse()
      }}
      onOpenChange={(open, details) => {
        if (!open) {
          details.cancel()
          collapse()
        }
      }}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop
          data-overview={expanded}
          className="table-totals-backdrop fixed inset-0 z-40 bg-black/50"
        />
        <Drawer.Viewport
          ref={setViewportElement}
          data-overview={expanded}
          className="table-totals-viewport fixed inset-0 z-40 flex items-end justify-center"
        >
          <Drawer.Popup
            ref={attachPopup}
            initialFocus={false}
            data-position-ready={positionReady}
            data-overview={expanded}
            className="table-totals-popup relative w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[1.5rem] bg-muted text-foreground shadow-dock outline-none"
          >
            <div ref={setCompactElement} inert={expanded} aria-hidden={expanded} className="table-totals-compact">
              <SplitSheetHandle ref={expandRef} onExpand={() => setExpanded(true)} itemsClaimed={itemsClaimed} itemsTotal={itemsTotal} remainingLbp={remainingLbp} rate={rate} />
              <div className="space-y-2.5 p-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {panelExtra ? <div>{panelExtra}</div> : null}
                <MobilePersonPicker
                  people={people}
                  activeId={activeId}
                  selfId={selfId}
                  onSelect={onSelect}
                  portfolioByPerson={portfolioByPerson}
                  ownIds={ownIds}
                  lineItems={lineItems}
                  claims={claims}
                  rate={rate}
                  serviceChargeOn={serviceChargeOn}
                  tipPercent={tipPercent}
                />
                {onAdd ? (
                  <MobileAddPerson onAdd={onAdd} actionSlot={actionSlot} editing={editingPerson} onEditingChange={setEditingPerson} />
                ) : actionSlot ? <div className="space-y-2">{actionSlot}</div> : null}
              </div>
            </div>
            <div inert={!expanded} aria-hidden={!expanded} className="table-totals-overview absolute inset-0 flex flex-col">
              <div className="shrink-0 px-5 pb-4 pt-3">
                <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground/20" />
                <div className="flex items-center justify-between gap-3">
                  <Drawer.Title className="text-xl font-extrabold tracking-tight">Table totals</Drawer.Title>
                  <button type="button" ref={collapseRef} onClick={collapse} aria-label="Collapse table totals" className="grid size-11 shrink-0 place-items-center rounded-full bg-background/70 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                    <RiCloseLine className="size-5" aria-hidden />
                  </button>
                </div>
                <Drawer.Description className="text-sm text-muted-foreground">Tap a person to see their items.</Drawer.Description>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned total</p>
                    <p className="mt-1 font-receipt text-xl font-bold text-primary-strong">{formatUsd(toUsd(grandLbp, rate))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Unclaimed items</p>
                    <p className="mt-1 font-receipt text-xl font-semibold">{formatUsd(toUsd(remainingLbp, rate))}</p>
                  </div>
                </div>
              </div>
              <Drawer.Content className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {rate ? <p className="mb-3 px-2 text-xs text-muted-foreground">Exchange rate <span className="font-receipt tabular-nums">$1 = {formatLbp(rate)}</span></p> : null}
                <Accordion.Root className="space-y-1">
                  {orderedBreakdownPeople.map((person) => {
                    const portfolio = portfolioByPerson.get(person.id)
                    if (!portfolio) return null
                    const lines = personClaimedLines(person.id, lineItems, claims)
                    return (
                      <Accordion.Item key={person.id} value={person.id} className="rounded-control bg-background/70">
                        <Accordion.Header>
                          <Accordion.Trigger className="group flex min-h-16 w-full items-center gap-3 rounded-control px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                            <PersonAvatar name={person.name} color={person.color} className="shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">{person.name}</span>
                              <span className="block text-xs text-muted-foreground">{lines.length === 0 ? 'Nothing claimed yet' : `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`}</span>
                            </span>
                            <span className="shrink-0 font-receipt text-sm font-semibold">{formatUsd(portfolio.totalUsd)}</span>
                            <RiArrowDownSLine aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-180 motion-reduce:transition-none" />
                          </Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Panel className="overflow-hidden">
                          <div className="space-y-3 px-3 pb-4 pt-1">
                            {lines.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Claim items from the receipt to see them here.</p>
                            ) : lines.map((line) => (
                              <div key={line.itemId} className="flex items-start justify-between gap-3 text-sm">
                                <span className="min-w-0 break-words text-muted-foreground">{formatUnits(line.units)} × {line.name}</span>
                                <span className="shrink-0 font-receipt">{formatUsd(toUsd(line.lbp, rate))}</span>
                              </div>
                            ))}
                            {serviceChargeOn && portfolio.serviceShareLbp !== 0 ? (
                              <div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>Service &amp; tax</span><span className="font-receipt">{formatUsd(toUsd(portfolio.serviceShareLbp, rate))}</span></div>
                            ) : null}
                            {portfolio.tipShareLbp !== 0 ? (
                              <div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>Tip{tipPercent ? ` (${tipPercent}%)` : ''}</span><span className="font-receipt">{formatUsd(toUsd(portfolio.tipShareLbp, rate))}</span></div>
                            ) : null}
                            <p className="border-t border-border/50 pt-2 text-right font-receipt text-xs text-muted-foreground">Total {formatLbp(portfolio.totalLbp)}</p>
                          </div>
                        </Accordion.Panel>
                      </Accordion.Item>
                    )
                  })}
                </Accordion.Root>

                {expandedExtra ? (
                  <div className="mt-4 rounded-control bg-background/70 px-4 py-3">
                    {expandedExtra}
                  </div>
                ) : null}
              </Drawer.Content>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
