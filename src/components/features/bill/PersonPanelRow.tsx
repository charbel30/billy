import { motion } from 'motion/react'
import { RiCloseLine, RiRadioButtonLine } from '@remixicon/react'
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
import { personColorValue } from '~/lib/bill/constants'

// One person in the desktop panel: avatar (opens their item breakdown), body
// (tap to make active), optional remove button, and the active radio marker.
export function PersonPanelRow({
  person,
  active,
  portfolio,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
  onSelect,
  onRemove,
}: {
  person: Person
  active: boolean
  portfolio?: Portfolio
  lineItems: LineItem[]
  claims: Claim[]
  rate?: number | null
  serviceChargeOn: boolean
  tipPercent?: number | null
  onSelect: (id: string) => void
  /** Present only when the viewer may remove this person. */
  onRemove?: (id: string) => void
}) {
  const total = portfolio?.totalUsd ?? 0
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      style={
        active
          ? {
              borderColor: personColorValue(person.color),
              backgroundColor: `color-mix(in oklab, ${personColorValue(person.color)} 8%, transparent)`,
            }
          : undefined
      }
      className={cn(
        'flex w-full items-center gap-2 rounded-control border-2 p-2 transition-colors',
        active ? '' : 'border-transparent bg-background hover:bg-muted/60',
      )}
    >
      {/* Avatar opens the person's item breakdown */}
      <Popover>
        <PopoverTrigger
          aria-label={`${person.name}'s items`}
          className="shrink-0 rounded-full transition-transform active:scale-[0.96]"
        >
          <PersonAvatar name={person.name} color={person.color} size="lg" />
        </PopoverTrigger>
        <PopoverContent side="left" align="start" sideOffset={8}>
          {portfolio ? (
            <PortfolioReceipt
              portfolio={portfolio}
              lines={personClaimedLines(person.id, lineItems, claims)}
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
        onClick={() => onSelect(person.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate font-bold">{person.name}</p>
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">
          {formatUsd(total)} assigned
        </p>
      </button>

      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${person.name}`}
          onClick={() => onRemove(person.id)}
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
        style={active ? { color: personColorValue(person.color) } : undefined}
      />
    </motion.div>
  )
}
