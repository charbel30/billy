import { AnimatePresence, motion } from 'motion/react'
import { RiAddLine, RiSubtractLine, RiGroupLine } from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import { claimedUnits, effectiveUnitPrice, remainingUnits } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { DEFAULT_PERSON_COLOR } from '~/lib/bill/constants'
import { formatUnits } from '~/lib/format'
import { cn } from '~/lib/utils'

function unitsFor(claims: Claim[], itemId: string, personId: string): number {
  return claims.find((c) => c.itemId === itemId && c.personId === personId)?.units ?? 0
}

// Pull units off each receipt line onto the active person (ui-flow-vision.md):
// tap a person → +1/-1 per item. Units decrement from the original receipt, so
// you always see what's left. "Split evenly" writes fractional units across all.
export function ClaimList({
  lineItems,
  people,
  claims,
  activePerson,
  rate,
  onStep,
  onShareEvenly,
}: {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  activePerson: Person | null
  rate: number | null | undefined
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: (itemId: string, personIds: string[]) => void
}) {
  const colorById = new Map(people.map((p) => [p.id, p.color]))

  return (
    <div className="divide-y divide-dashed divide-border">
      {lineItems.map((item) => {
        const remaining = remainingUnits(item, claims)
        const mine = activePerson ? unitsFor(claims, item.id, activePerson.id) : 0
        const claimants = claims.filter((c) => c.itemId === item.id && c.units > 0)
        const unit = effectiveUnitPrice(item)

        return (
          <div key={item.id} className="py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatLbp(unit)}
                  {rate ? ` · ${formatUsd(toUsd(unit, rate))}` : ''} / unit ·{' '}
                  <span className={cn(remaining > 0 ? 'text-amber-600' : '')}>
                    {formatUnits(remaining)} of {formatUnits(item.qty)} left
                  </span>
                </div>
              </div>

              {/* Stepper for the active person */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Remove one"
                  disabled={!activePerson || mine <= 0}
                  onClick={() => activePerson && onStep(item.id, activePerson.id, -1)}
                  className="grid size-8 place-items-center rounded-full border border-border disabled:opacity-30 hover:bg-muted"
                >
                  <RiSubtractLine className="size-4" />
                </button>
                <div className="w-7 text-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={mine}
                      initial={{ y: -8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 8, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="inline-block font-semibold tabular-nums"
                    >
                      {formatUnits(mine)}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  aria-label="Add one"
                  disabled={!activePerson || remaining <= 0.0001}
                  onClick={() => activePerson && onStep(item.id, activePerson.id, +1)}
                  className="grid size-8 place-items-center rounded-full border border-border disabled:opacity-30 hover:bg-muted"
                  style={
                    activePerson && remaining > 0.0001
                      ? { backgroundColor: activePerson.color, color: 'white', borderColor: 'transparent' }
                      : undefined
                  }
                >
                  <RiAddLine className="size-4" />
                </button>
              </div>
            </div>

            {/* Who has claimed this line + even-split shortcut */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                <AnimatePresence initial={false}>
                  {claimants.map((c) => (
                    <motion.span
                      key={c.personId}
                      layout
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor:
                            colorById.get(c.personId) ?? DEFAULT_PERSON_COLOR,
                        }}
                      />
                      {formatUnits(c.units)}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              {people.length > 1 && (
                <button
                  type="button"
                  onClick={() => onShareEvenly(item.id, people.map((p) => p.id))}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RiGroupLine className="size-3.5" /> split evenly
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
