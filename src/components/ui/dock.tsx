import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { RiArrowUpSLine, RiCloseLine } from '@remixicon/react'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { cn } from '~/lib/utils'
import './dock.css'

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect

/** Everything below `lg:` gets the dock; desktop renders the panel in an aside. */
const MOBILE_QUERY = '(max-width: 1023px)'
/** Expanded snap point, as a fraction of the viewport — matches the popup height. */
const EXPANDED_SNAP = 0.85
/** The dock floats `--dock-inset` above the edge; pages must pad past both. */
const DOCK_INSET_PX = 16

export interface DockHandleSpec {
  label: string
  status?: string
  ariaLabel: string
}

/**
 * The persistent floating dock: always open, two states (collapsed row(s) and
 * an expanded panel), swipe or tap to move between them. Zero domain
 * knowledge — every screen feeds it its own `collapsed` / `panel` content.
 */
export function Dock({
  collapsed,
  panel,
  panelTitle,
  panelDescription,
  expanded,
  onExpandedChange,
  handle,
  collapsedHeightHint,
  onCollapsedHeightChange,
  keyboardAware = false,
  mobileOnly = true,
}: {
  /** Collapsed content: one or two rows. Always visible when collapsed. */
  collapsed: ReactNode
  /** Expanded panel. Omit for a dock that never expands (summary). */
  panel?: ReactNode
  /** Header row of the expanded panel (title + description). */
  panelTitle?: string
  panelDescription?: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** Handle row label + trailing status. Omit `handle` when `panel` is omitted. */
  handle?: DockHandleSpec
  /** Declared collapsed height in px for the first paint (refined by ResizeObserver). */
  collapsedHeightHint: number
  /** Reports measured collapsed height (+ inset) so the page can pad content past it. */
  onCollapsedHeightChange?: (px: number) => void
  /** Lift the collapsed dock above the software keyboard while an inline input is focused. */
  keyboardAware?: boolean
  /** Only render on viewports below lg; default true. Desktop renders content in an aside instead. */
  mobileOnly?: boolean
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const open = mobileOnly ? isMobile : true
  const hasPanel = Boolean(panel)

  const [collapsedHeight, setCollapsedHeight] = useState(collapsedHeightHint)
  const [popupElement, setPopupElement] = useState<HTMLDivElement | null>(null)
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null,
  )
  const [compactElement, setCompactElement] = useState<HTMLDivElement | null>(
    null,
  )
  const [inlineInputFocused, setInlineInputFocused] = useState(false)
  const expandRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)

  const collapsedPoint = `${collapsedHeight}px`
  const snapPoints = useMemo(
    () => (hasPanel ? [collapsedPoint, EXPANDED_SNAP] : [collapsedPoint]),
    [collapsedPoint, hasPanel],
  )

  const collapse = useCallback(() => {
    if (!expanded) return
    onExpandedChange(false)
    requestAnimationFrame(() => expandRef.current?.focus({ preventScroll: true }))
  }, [expanded, onExpandedChange])

  // Desktop takes the dock away; never leave the page thinking it is expanded.
  useEffect(() => {
    if (!open && expanded) onExpandedChange(false)
  }, [open, expanded, onExpandedChange])

  useIsomorphicLayoutEffect(() => {
    const el = compactElement
    if (!el) return
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height === 0) return
      setCollapsedHeight(height)
      onCollapsedHeightChange?.(height + DOCK_INSET_PX)
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
    if (!popup || !viewport || !compactElement || !hasPanel) return
    let frame = 0
    let settleUntil = 0
    const paint = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(popup).transform)
      // Measure the real compact height rather than trusting the declared
      // hint: the hint only has to be close enough for the first frame.
      const travel =
        popup.clientHeight - Math.ceil(compactElement.getBoundingClientRect().height)
      const progress =
        travel > 0 ? Math.max(0, Math.min(1, 1 - matrix.m42 / travel)) : 0
      viewport.style.setProperty('--sheet-progress', String(progress))
      frame = performance.now() < settleUntil ? requestAnimationFrame(paint) : 0
    }
    const follow = () => {
      settleUntil = performance.now() + 300
      if (!frame) paint()
    }
    const observer = new MutationObserver(follow)
    observer.observe(popup, {
      attributes: true,
      attributeFilter: ['style', 'data-swiping', 'data-dock-expanded'],
    })
    follow()
    window.addEventListener('resize', follow)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', follow)
      cancelAnimationFrame(frame)
    }
  }, [popupElement, viewportElement, compactElement, collapsedHeight, hasPanel])

  // Text entry inside the collapsed dock (the inline add-person form) is the
  // one case where the software keyboard would cover the dock itself.
  useEffect(() => {
    if (!keyboardAware || !popupElement) return
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      setInlineInputFocused(
        target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable),
      )
    }
    const onFocusOut = () => setInlineInputFocused(false)
    popupElement.addEventListener('focusin', onFocusIn)
    popupElement.addEventListener('focusout', onFocusOut)
    return () => {
      popupElement.removeEventListener('focusin', onFocusIn)
      popupElement.removeEventListener('focusout', onFocusOut)
    }
  }, [keyboardAware, popupElement])

  // On mobile the keyboard can shrink only the visual viewport. Lift the
  // collapsed dock by that inset so the inline form stays above it.
  useEffect(() => {
    const visual = window.visualViewport
    if (!visual || !viewportElement || !inlineInputFocused || expanded) return
    const sync = () =>
      viewportElement.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, window.innerHeight - visual.height - visual.offsetTop)}px`,
      )
    sync()
    visual.addEventListener('resize', sync)
    visual.addEventListener('scroll', sync)
    return () => {
      visual.removeEventListener('resize', sync)
      visual.removeEventListener('scroll', sync)
      viewportElement.style.removeProperty('--keyboard-inset')
    }
  }, [inlineInputFocused, expanded, viewportElement])

  useEffect(() => {
    if (expanded) collapseRef.current?.focus({ preventScroll: true })
  }, [expanded])

  return (
    <Drawer.Root
      open={open}
      modal={expanded}
      snapPoints={snapPoints}
      snapPoint={expanded ? EXPANDED_SNAP : collapsedPoint}
      snapToSequentialPoints
      onSnapPointChange={(point) => {
        if (point === EXPANDED_SNAP) onExpandedChange(true)
        else collapse()
      }}
      onOpenChange={(nextOpen, details) => {
        // Swiping down collapses the dock; it never closes.
        if (!nextOpen) {
          details.cancel()
          collapse()
        }
      }}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop
          data-dock-expanded={expanded}
          className="dock-backdrop fixed inset-0 z-40 bg-black/50"
        />
        <Drawer.Viewport
          ref={setViewportElement}
          data-dock-expanded={expanded}
          className="dock-viewport fixed inset-0 z-40 flex items-end justify-center"
        >
          <Drawer.Popup
            ref={setPopupElement}
            initialFocus={false}
            data-dock-expanded={expanded}
            style={
              {
                '--dock-offset': expanded
                  ? '0px'
                  : `calc(${EXPANDED_SNAP * 100}dvh - ${collapsedHeight}px)`,
                viewTransitionName: 'dock',
              } as CSSProperties
            }
            className="dock-popup surface-dock relative w-[calc(100%-2*var(--dock-inset))] max-w-[var(--dock-max-width)] overflow-hidden text-foreground outline-none"
          >
            <div
              ref={setCompactElement}
              inert={expanded}
              aria-hidden={expanded}
              className="dock-compact"
            >
              {handle && hasPanel ? (
                <DockHandle ref={expandRef} spec={handle} onExpand={() => onExpandedChange(true)} />
              ) : null}
              <div className={cn('p-3', handle && hasPanel && 'pt-2')}>
                {collapsed}
              </div>
            </div>

            {hasPanel ? (
              <div
                inert={!expanded}
                aria-hidden={!expanded}
                className="dock-panel absolute inset-0 flex flex-col"
              >
                <div className="shrink-0 px-5 pb-4 pt-3">
                  <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground/20" />
                  <div className="flex items-center justify-between gap-3">
                    <Drawer.Title className="text-xl font-extrabold tracking-tight">
                      {panelTitle}
                    </Drawer.Title>
                    <button
                      type="button"
                      ref={collapseRef}
                      onClick={collapse}
                      aria-label={`Collapse ${panelTitle ?? 'panel'}`}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-background/70 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <RiCloseLine className="size-5" aria-hidden />
                    </button>
                  </div>
                  {panelDescription ? (
                    <Drawer.Description className="text-sm text-muted-foreground">
                      {panelDescription}
                    </Drawer.Description>
                  ) : null}
                </div>
                <Drawer.Content className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  {panel}
                </Drawer.Content>
              </div>
            ) : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

// Drawer.Viewport handles swipes on the persistent dock; this button is the
// keyboard/tap route into the panel (and the grab affordance).
function DockHandle({
  ref,
  spec,
  onExpand,
}: {
  ref?: Ref<HTMLButtonElement>
  spec: DockHandleSpec
  onExpand: () => void
}) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onExpand}
      aria-label={spec.ariaLabel}
      className="flex min-h-16 w-full flex-col items-center gap-2 rounded-t-dock px-4 pb-2 pt-3 text-left transition-colors hover:bg-background/30 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-foreground/20" />
      <span className="flex w-full items-center justify-between gap-3">
        <span className="text-sm font-semibold">{spec.label}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {spec.status}
          <RiArrowUpSLine className="size-4" aria-hidden />
        </span>
      </span>
    </button>
  )
}
