import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiRadioButtonLine,
  RiUserAddLine,
} from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import type { Portfolio } from '~/lib/split'
import { personClaimedLines } from '~/lib/split'
import { formatUsd } from '~/lib/currency'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { PersonAvatar } from './PersonAvatar'
import { PortfolioReceipt } from './PortfolioReceipt'
import { cn } from '~/lib/utils'

// People selector for splitting. Pick a person to make them "active", then pull
// units onto them in the ClaimList (ui-flow-vision.md). Renders as a vertical
// "panel" (desktop aside) or a horizontal "bar" (mobile). Both show each person's
// running USD total; on the panel, tapping the avatar opens their item breakdown.
export function PersonRail({
  people,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  portfolioByPerson,
  lineItems = [],
  claims = [],
  rate,
  serviceChargeOn = false,
  tipPercent,
  variant = 'panel',
  addLabel = 'Add person',
  addPlaceholder = 'Add person',
  ownIds,
  trailing,
}: {
  people: Person[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd?: (name: string) => void
  onRemove?: (id: string) => void
  portfolioByPerson?: Map<string, Portfolio>
  lineItems?: LineItem[]
  claims?: Claim[]
  rate?: number | null
  serviceChargeOn?: boolean
  tipPercent?: number | null
  variant?: 'panel' | 'bar'
  addLabel?: string
  addPlaceholder?: string
  /** Ids the viewer controls (e.g. a guest's own people). When set, only
   * these render as individual pills/rows; everyone else is left to the
   * caller (in the bar variant, via `trailing`). */
  ownIds?: ReadonlySet<string>
  /** Bar variant only: rendered after the Add pill, inside the same
   * scrollable row — e.g. an "others" summary pill for people not in `ownIds`. */
  trailing?: ReactNode
}) {
  if (variant === 'bar') {
    const ownPeople = ownIds ? people.filter((p) => ownIds.has(p.id)) : people
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {ownPeople.map((p) => {
            const active = p.id === activeId
            const portfolio = portfolioByPerson?.get(p.id)
            const total = portfolio?.totalUsd ?? 0
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={active ? { backgroundColor: p.color } : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold transition-[background-color,border-color,color]',
                  active
                    ? 'border-transparent text-white'
                    : 'border-transparent bg-background hover:bg-muted',
                )}
              >
                {/* Avatar opens the person's item breakdown */}
                <Popover>
                  <PopoverTrigger
                    aria-label={`${p.name}'s items`}
                    className="shrink-0 rounded-full transition-transform active:scale-[0.96]"
                  >
                    <PersonAvatar name={p.name} color={p.color} size="md" />
                  </PopoverTrigger>
                  <PopoverContent side="top" align="center" sideOffset={10}>
                    {portfolio ? (
                      <PortfolioReceipt
                        portfolio={portfolio}
                        lines={personClaimedLines(p.id, lineItems, claims)}
                        rate={rate}
                        serviceChargeOn={serviceChargeOn}
                        tipPercent={tipPercent}
                        bare
                      />
                    ) : null}
                  </PopoverContent>
                </Popover>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="whitespace-nowrap text-left leading-none"
                >
                  {p.name}
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums',
                      active ? 'text-white/80' : 'text-muted-foreground',
                    )}
                  >
                    {formatUsd(total)}
                  </span>
                </motion.button>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {onAdd ? (
          <AddPerson onAdd={onAdd} variant="bar" placeholder={addPlaceholder} />
        ) : null}
        {trailing}
      </div>
    )
  }

  const panelOwnPeople = ownIds ? people.filter((p) => ownIds.has(p.id)) : []
  const panelOtherPeople = ownIds
    ? people.filter((p) => !ownIds.has(p.id))
    : people
  const panelHasOwn = panelOwnPeople.length > 0

  const renderRow = (p: Person) => {
    const active = p.id === activeId
    const portfolio = portfolioByPerson?.get(p.id)
    const total = portfolio?.totalUsd ?? 0
    return (
      <motion.div
        key={p.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        style={
          active
            ? { borderColor: p.color, backgroundColor: `${p.color}14` }
            : undefined
        }
        className={cn(
          'flex w-full items-center gap-2 rounded-3xl border-2 p-2 transition-colors',
          active ? '' : 'border-transparent bg-background hover:bg-muted/60',
        )}
      >
        {/* Avatar opens the person's item breakdown */}
        <Popover>
          <PopoverTrigger
            aria-label={`${p.name}'s items`}
            className="shrink-0 rounded-full transition-transform active:scale-[0.96]"
          >
            <PersonAvatar name={p.name} color={p.color} size="lg" />
          </PopoverTrigger>
          <PopoverContent side="left" align="start" sideOffset={8}>
            {portfolio ? (
              <PortfolioReceipt
                portfolio={portfolio}
                lines={personClaimedLines(p.id, lineItems, claims)}
                rate={rate}
                serviceChargeOn={serviceChargeOn}
                tipPercent={tipPercent}
                bare
              />
            ) : null}
          </PopoverContent>
        </Popover>

        {/* Tapping the body makes this person active */}
        <button
          type="button"
          onClick={() => onSelect(p.id)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate font-bold">{p.name}</p>
          <p className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatUsd(total)} assigned
          </p>
        </button>

        {onRemove && people.length > 1 ? (
          <button
            type="button"
            aria-label={`Remove ${p.name}`}
            onClick={() => onRemove(p.id)}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-60 transition-[opacity,transform] hover:opacity-100 active:scale-[0.96]"
          >
            <RiCloseLine className="size-4" />
          </button>
        ) : null}

        <RiRadioButtonLine
          className={cn(
            'size-5 shrink-0',
            !active && 'text-muted-foreground opacity-40',
          )}
          style={active ? { color: p.color } : undefined}
        />
      </motion.div>
    )
  }

  const addRow = onAdd ? (
    <AddPerson
      onAdd={onAdd}
      variant="panel"
      label={addLabel}
      placeholder={addPlaceholder}
    />
  ) : null

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {panelOwnPeople.map(renderRow)}
      </AnimatePresence>
      {panelHasOwn ? addRow : null}
      <AnimatePresence initial={false}>
        {panelOtherPeople.map(renderRow)}
      </AnimatePresence>
      {panelHasOwn ? null : addRow}
    </div>
  )
}

function AddPerson({
  onAdd,
  variant,
  label = 'Add person',
  placeholder = 'Add person',
}: {
  onAdd: (name: string) => void
  variant: 'panel' | 'bar'
  label?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
    setOpen(false)
  }

  if (!open) {
    if (variant === 'bar') {
      return (
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-border text-primary transition-[transform,background-color] hover:bg-muted active:scale-[0.96]"
        >
          <RiUserAddLine className="size-5" />
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/30 px-4 py-3 text-sm font-bold text-primary transition-[transform,background-color] hover:bg-primary/10 active:scale-[0.96]"
      >
        <RiUserAddLine className="size-5" /> {label}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1',
        variant === 'bar' ? 'shrink-0' : 'rounded-3xl px-3 py-2',
      )}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setOpen(false)
        }}
        onBlur={() => (name.trim() ? submit() : setOpen(false))}
        placeholder={placeholder}
        className="w-28 bg-transparent text-sm outline-none"
      />
      <button
        type="button"
        onClick={submit}
        aria-label={label}
        className="grid size-7 shrink-0 place-items-center rounded-full text-primary transition-[transform,color] hover:text-foreground active:scale-[0.96]"
      >
        {variant === 'bar' ? (
          <RiAddLine className="size-4" />
        ) : (
          <RiCheckLine className="size-4" />
        )}
      </button>
    </div>
  )
}
