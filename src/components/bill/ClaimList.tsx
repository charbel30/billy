import { AnimatePresence, motion } from 'motion/react'
import {
  RiAddLine,
  RiCheckLine,
  RiGroupLine,
  RiSubtractLine,
} from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import { effectiveUnitPrice, remainingUnits } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { formatUnits } from '~/lib/format'
import { PersonAvatar } from './PersonAvatar'
import { cn } from '~/lib/utils'

function unitsFor(claims: Claim[], itemId: string, personId: string): number {
  return claims.find((c) => c.itemId === itemId && c.personId === personId)?.units ?? 0
}

// Pull units off each receipt line onto the active person (ui-flow-vision.md):
// pick a person → +1/-1 per item. Units decrement from the original receipt, so
// you always see what's left ("$X left" → "Done" once a line is fully assigned).
// "Split evenly" writes fractional units across all the people on the bill.
export function ClaimList({
  lineItems,
  people,
  claims,
  activePerson,
  rate,
  onStep,
  onShareEvenly,
  canShareEvenly = true,
  sharePeople = people,
}: {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  activePerson: Person | null
  rate: number | null | undefined
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: (itemId: string, personIds: string[]) => void
  canShareEvenly?: boolean
  sharePeople?: Person[]
}) {
  const personById = new Map(people.map((p) => [p.id, p]))

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {lineItems.map((item) => {
          const remaining = remainingUnits(item, claims)
          const mine = activePerson ? unitsFor(claims, item.id, activePerson.id) : 0
          const claimants = claims.filter(
            (c) => c.itemId === item.id && c.units > 0,
          )
          const unit = effectiveUnitPrice(item)
          const done = remaining <= 0.0001
          const remainingLbp = remaining * unit

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(
                'rounded-3xl bg-background/85 p-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)] ring-1 ring-border/35 transition-shadow sm:p-5',
                done
                  ? 'opacity-70'
                  : 'hover:shadow-[0_18px_44px_rgba(0,0,0,0.08)]',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        'truncate text-base font-black tracking-tight',
                        done && 'line-through',
                      )}
                    >
                      {item.name}
                    </h4>
                    {item.qty !== 1 ? (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                        ×{formatUnits(item.qty)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                    {formatLbp(item.lineTotal)}
                    {item.qty !== 1
                      ? ` · ${formatLbp(unit)}${rate ? ` / ${formatUsd(toUsd(unit, rate))}` : ''} ea`
                      : ''}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="block text-lg font-black tracking-tight text-primary tabular-nums">
                    {formatUsd(toUsd(item.lineTotal, rate))}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                {/* Who has claimed this line so far */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {claimants.length > 0 ? (
                    <div className="flex -space-x-2">
                      <AnimatePresence initial={false}>
                        {claimants.map((c) => {
                          const p = personById.get(c.personId)
                          return (
                            <motion.div
                              key={c.personId}
                              layout
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                            >
                              <PersonAvatar
                                name={p?.name ?? '?'}
                                color={p?.color}
                                size="sm"
                                title={`${p?.name ?? 'Someone'} · ${formatUnits(c.units)}`}
                              />
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      Unassigned
                    </span>
                  )}

                  {canShareEvenly && sharePeople.length > 1 && !done && (
                    <button
                      type="button"
                      onClick={() =>
                        onShareEvenly(
                          item.id,
                          sharePeople.map((p) => p.id),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground transition-[transform,color] hover:text-foreground active:scale-[0.96]"
                    >
                      <RiGroupLine className="size-3.5" /> split evenly
                    </button>
                  )}
                </div>

                {/* Remaining state + stepper for the active person */}
                <div className="flex shrink-0 items-center gap-2">
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                      <RiCheckLine className="size-4" /> Done
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600 tabular-nums">
                      {formatUsd(toUsd(remainingLbp, rate))} left
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Remove one"
                      disabled={!activePerson || mine <= 0}
                      onClick={() =>
                        activePerson && onStep(item.id, activePerson.id, -1)
                      }
                      className="grid size-9 place-items-center rounded-full border border-border transition-[transform,background-color] hover:bg-muted active:scale-[0.96] disabled:opacity-30"
                    >
                      <RiSubtractLine className="size-4" />
                    </button>
                    <div className="w-6 text-center">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={mine}
                          initial={{ y: -8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="inline-block font-bold tabular-nums"
                        >
                          {formatUnits(mine)}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <button
                      type="button"
                      aria-label="Add one"
                      disabled={!activePerson || remaining <= 0.0001}
                      onClick={() =>
                        activePerson && onStep(item.id, activePerson.id, +1)
                      }
                      className="grid size-9 place-items-center rounded-full border border-border transition-[transform,background-color] hover:bg-muted active:scale-[0.96] disabled:opacity-30"
                      style={
                        activePerson && remaining > 0.0001
                          ? {
                              backgroundColor: activePerson.color,
                              color: 'white',
                              borderColor: 'transparent',
                            }
                          : undefined
                      }
                    >
                      <RiAddLine className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
