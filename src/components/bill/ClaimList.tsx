import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  RiAddLine,
  RiCheckboxCircleFill,
  RiGroupLine,
  RiSubtractLine,
} from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import { effectiveUnitPrice, remainingUnits } from '~/lib/split'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import { formatUnits } from '~/lib/format'
import { PersonAvatar } from './PersonAvatar'
import { cn } from '~/lib/utils'

// Contextual swap animation shared by the controls ⇄ done morph (skill values).
const swap = {
  initial: { opacity: 0, scale: 0.25, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.25, filter: 'blur(4px)' },
  transition: { type: 'spring' as const, duration: 0.3, bounce: 0 },
}

function unitsFor(claims: Claim[], itemId: string, personId: string): number {
  return claims.find((c) => c.itemId === itemId && c.personId === personId)?.units ?? 0
}

// Pull units off each receipt line onto the active person (ui-flow-vision.md):
// pick a person → +1/-1 per item. Tapping a claimant's avatar removes one of
// THEIR units (without changing who's active). A line greys out + collapses to a
// check once it's fully assigned. "Split evenly" is the compact group button.
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

          // One light subtitle: per-unit price (when multi-qty) + how many units
          // are still free — kept as a count, not another money figure.
          const perEa = item.qty !== 1 ? `${formatUsd(toUsd(unit, rate))} ea` : null
          const leftLabel = done ? null : `${formatUnits(remaining)} left`
          const subtitle = [perEa, leftLabel].filter(Boolean).join(' · ') || null

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
              className={cn(
                'rounded-3xl border transition-[box-shadow,background-color,border-color,opacity]',
                done
                  ? 'border-dashed border-border/70 bg-muted p-2.5 opacity-75'
                  : 'border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_30px_rgba(0,0,0,0.10)] hover:border-foreground/20 hover:shadow-[0_2px_6px_rgba(0,0,0,0.10),0_18px_44px_rgba(0,0,0,0.14)]',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <motion.div layout="position" className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        'truncate font-black tracking-tight transition-colors',
                        done
                          ? 'text-sm text-muted-foreground'
                          : 'text-base text-foreground',
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
                  {subtitle ? (
                    <p
                      className={cn(
                        'mt-0.5 text-xs font-semibold tabular-nums transition-colors',
                        done
                          ? 'text-muted-foreground/70'
                          : 'text-muted-foreground',
                      )}
                    >
                      {subtitle}
                    </p>
                  ) : null}
                </motion.div>

                {/* Price — USD; tap to flash the LBP for a moment */}
                <motion.div layout="position" className="shrink-0">
                  <ItemPrice lbp={item.lineTotal} rate={rate} done={done} />
                </motion.div>
              </div>

              <motion.div
                layout="position"
                className={cn(
                  'flex items-center justify-between gap-3',
                  done ? 'mt-2' : 'mt-3',
                )}
              >
                {/* Claimants — tap a pill to drop one of that person's units */}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {claimants.length > 0 ? (
                    <AnimatePresence initial={false} mode="popLayout">
                      {claimants.map((c) => {
                        const p = personById.get(c.personId)
                        const isActive = activePerson?.id === c.personId
                        return (
                          <motion.button
                            key={c.personId}
                            layout
                            type="button"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
                            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => onStep(item.id, c.personId, -1)}
                            title={`${p?.name ?? 'Someone'} · ${formatUnits(c.units)} — tap to remove one`}
                            aria-label={`Remove one from ${p?.name ?? 'person'}`}
                            className={cn(
                              'group/pill inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-1.5 transition-[box-shadow,background-color]',
                              isActive
                                ? 'bg-background'
                                : 'bg-background/70 ring-1 ring-border/40 hover:ring-destructive/40',
                            )}
                            style={
                              isActive
                                ? { boxShadow: `0 0 0 2px ${p?.color ?? '#999'}` }
                                : undefined
                            }
                          >
                            <PersonAvatar
                              name={p?.name ?? '?'}
                              color={p?.color}
                              size="sm"
                            />
                            {c.units !== 1 ? (
                              <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                                {formatUnits(c.units)}
                              </span>
                            ) : null}
                          </motion.button>
                        )
                      })}
                    </AnimatePresence>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      Unassigned
                    </span>
                  )}
                </div>

                {/* Active-person controls morph into a done check + undo hint */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {done ? (
                    <motion.div
                      key="done"
                      {...swap}
                      className="flex shrink-0 items-center gap-1.5 text-primary"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        tap avatar to remove
                      </span>
                      <RiCheckboxCircleFill className="size-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="controls"
                      {...swap}
                      className="flex shrink-0 items-center gap-1.5"
                    >
                      {canShareEvenly && sharePeople.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Split evenly across everyone"
                          title="Split evenly across everyone"
                          onClick={() =>
                            onShareEvenly(
                              item.id,
                              sharePeople.map((p) => p.id),
                            )
                          }
                          className="grid size-9 place-items-center rounded-full text-muted-foreground transition-[transform,color,background-color] hover:bg-muted hover:text-foreground active:scale-[0.96]"
                        >
                          <RiGroupLine className="size-4" />
                        </button>
                      ) : null}

                      <div className="flex items-center gap-0.5">
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// Shows the line price in USD; tapping flips it to LBP for ~1.6s, then reverts —
// dual-currency on demand without spending a permanent second line per card.
function ItemPrice({
  lbp,
  rate,
  done,
}: {
  lbp: number
  rate: number | null | undefined
  done: boolean
}) {
  const [showLbp, setShowLbp] = useState(false)

  useEffect(() => {
    if (!showLbp) return
    const t = setTimeout(() => setShowLbp(false), 1600)
    return () => clearTimeout(t)
  }, [showLbp])

  return (
    <button
      type="button"
      onClick={() => setShowLbp((v) => !v)}
      aria-label="Show price in Lebanese pounds"
      className="text-right transition-transform active:scale-[0.96]"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {showLbp ? (
          <motion.span
            key="lbp"
            {...swap}
            className={cn(
              'block whitespace-nowrap font-black tracking-tight tabular-nums',
              done ? 'text-sm text-muted-foreground' : 'text-base text-foreground',
            )}
          >
            {formatLbp(lbp)}
          </motion.span>
        ) : (
          <motion.span
            key="usd"
            {...swap}
            className={cn(
              'block font-black tracking-tight tabular-nums',
              done ? 'text-sm text-muted-foreground' : 'text-lg text-primary',
            )}
          >
            {formatUsd(toUsd(lbp, rate))}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
