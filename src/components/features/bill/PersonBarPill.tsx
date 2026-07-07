import { motion } from 'motion/react'
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

// One person in the horizontal mobile bar: avatar (opens their item breakdown)
// + name + running USD total; tapping the body makes them active.
export function PersonBarPill({
  person,
  active,
  portfolio,
  lineItems,
  claims,
  rate,
  serviceChargeOn,
  tipPercent,
  onSelect,
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
}) {
  const total = portfolio?.totalUsd ?? 0
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={active ? { backgroundColor: personColorValue(person.color) } : undefined}
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
          aria-label={`${person.name}'s items`}
          className="shrink-0 rounded-full transition-transform active:scale-[0.96]"
        >
          <PersonAvatar name={person.name} color={person.color} size="md" />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={10}
          className="max-w-[calc(100vw-2rem)]"
        >
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
      <motion.button
        whileTap={{ scale: 0.96 }}
        type="button"
        onClick={() => onSelect(person.id)}
        className="whitespace-nowrap text-left leading-none"
      >
        {person.name}
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
}
