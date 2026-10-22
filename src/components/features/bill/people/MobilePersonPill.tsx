import { useEffect, useRef, useState, type Ref } from 'react'
import { RiCloseLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/money'
import { formatUsd, personClaimedLines } from '~/lib/money'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { tapHaptic } from '~/lib/ui'
import { PersonAvatar } from './PersonAvatar'
import { PortfolioReceipt } from '../receipt'

export function MobilePersonPill({ person, active, readOnly = false, buttonRef, onSelect, portfolio, lineItems, claims, rate, serviceChargeOn, tipPercent }: {
  person: Person
  active: boolean
  /** Visible but not selectable (a guest viewing the host's person): a tap
   * shows their total instead of selecting them. */
  readOnly?: boolean
  buttonRef?: Ref<HTMLButtonElement>
  onSelect: (id: string) => void
  portfolio?: Portfolio
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
}) {
  const [peek, setPeek] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const held = useRef(false)
  const moved = useRef(false)
  function cancelHold() {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  useEffect(() => cancelHold, [])

  return (
    <Popover open={peek} onOpenChange={setPeek}>
      <PopoverTrigger ref={buttonRef} aria-pressed={active}
        aria-label={`${readOnly ? 'View total for' : 'Pick items for'} ${person.name}, ${formatUsd(portfolio?.totalUsd ?? 0)}`}
        title={readOnly ? 'Tap to see their total.' : 'Tap to select. Hold the avatar or press Shift+F10 for their total.'}
        onPointerDown={(event) => {
          cancelHold()
          held.current = false
          moved.current = false
          origin.current = { x: event.clientX, y: event.clientY }
          if (event.button !== 0 || !(event.target instanceof Element) || !event.target.closest('[data-person-avatar]')) return
          holdTimer.current = setTimeout(() => {
            held.current = true
            tapHaptic(16)
            setPeek(true)
            holdTimer.current = null
          }, 400)
        }}
        onPointerMove={(event) => {
          if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) {
            moved.current = true
            cancelHold()
          }
        }}
        onPointerUp={cancelHold}
        onPointerCancel={() => { moved.current = true; cancelHold() }}
        onPointerLeave={cancelHold}
        onContextMenu={(event) => {
          event.preventDefault()
          cancelHold()
          if (!moved.current) { held.current = true; setPeek(true) }
        }}
        onKeyDown={(event) => {
          if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu' || (event.altKey && event.key === 'ArrowUp')) {
            event.preventDefault()
            setPeek(true)
          }
        }}
        onClick={(event) => {
          event.preventBaseUIHandler()
          if (event.detail !== 0 && (held.current || moved.current)) return
          if (readOnly) setPeek(true)
          else onSelect(person.id)
        }}
        className={cn('flex min-h-12 max-w-36 shrink-0 select-none items-center gap-1.5 rounded-full px-2.5 py-1.5 text-left transition-colors [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          active ? 'bg-primary/15 ring-1 ring-inset ring-primary/35' : 'bg-background/80 hover:bg-background')}>
        <span data-person-avatar><PersonAvatar name={person.name} color={person.color} size="sm" /></span>
        <span className="min-w-0">
          <span className="block max-w-20 truncate text-xs font-bold">{person.name}</span>
          <span className="block font-receipt text-[11px] tabular-nums text-muted-foreground">{formatUsd(portfolio?.totalUsd ?? 0)}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={12} className="max-h-[60dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between gap-2">
          <PopoverTitle className="font-bold">{person.name}’s total</PopoverTitle>
          <button type="button" aria-label="Close person total" onClick={() => setPeek(false)} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><RiCloseLine aria-hidden className="size-5" /></button>
        </div>
        {portfolio ? <PortfolioReceipt portfolio={portfolio} lines={personClaimedLines(person.id, lineItems, claims)} rate={rate} serviceChargeOn={serviceChargeOn} tipPercent={tipPercent} bare /> : <p className="text-sm text-muted-foreground">Nothing claimed yet.</p>}
      </PopoverContent>
    </Popover>
  )
}
