import { AnimatePresence, motion } from 'motion/react'
import {
  RiAddLine,
  RiCheckboxCircleFill,
  RiGroupLine,
  RiSubtractLine,
} from '@remixicon/react'
import type { Claim, LineItem, Person } from '~/lib/types'
import { effectiveUnitPrice, remainingUnits, formatLbp, formatUsd, toUsd } from '~/lib/money'
import { formatUnits } from '~/lib/format'
import {
  ELEVATED_CARD,
  ELEVATED_CARD_HOVER,
  personColorValue,
  itemEmoji,
  unitsFor,
} from '~/lib/bill'
import { tapHaptic, swap } from '~/lib/ui'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import { PersonAvatar } from '../people'
import { ItemPrice } from '../receipt'
import { FitText } from '~/components/ui/fit-text'
import { cn } from '~/lib/utils'

// One receipt line in the claim list: name + qty badge, tap-to-flip price,
// claimant pills (tap to drop a unit), and the active person's +/- stepper,
// which morphs into a done check once the line is fully assigned.
export function ClaimListItem({
  item,
  claims,
  personById,
  activePerson,
  rate,
  onStep,
  onShareEvenly,
  canShareEvenly,
  sharePeople,
}: {
  item: LineItem
  claims: Claim[]
  personById: Map<string, Person>
  activePerson: Person | null
  rate: number | null | undefined
  /** Already haptic-wrapped by the parent list. */
  onStep: (itemId: string, personId: string, delta: number) => void
  onShareEvenly: (itemId: string, personIds: string[]) => void
  canShareEvenly: boolean
  sharePeople: Person[]
}) {
  const { display } = useCurrencyDisplay()
  const remaining = remainingUnits(item, claims)
  const mine = activePerson ? unitsFor(claims, item.id, activePerson.id) : 0
  const claimants = claims.filter((c) => c.itemId === item.id && c.units > 0)
  const unit = effectiveUnitPrice(item)
  const done = remaining <= 0.0001
  const emoji = itemEmoji(item.name)

  // One light subtitle: per-unit price (when multi-qty) + how many units
  // are still free — kept as a count, not another money figure.
  const perEa =
    item.qty !== 1
      ? `${display === 'lbp' ? formatLbp(unit) : formatUsd(toUsd(unit, rate))} ea`
      : null
  const leftLabel = done ? null : `${formatUnits(remaining)} left`
  const subtitle = [perEa, leftLabel].filter(Boolean).join(' · ') || null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      // Motion owns opacity (enter/exit + done dimming); keeping it out of the
      // CSS transition list avoids double-driving every animation frame.
      animate={{ opacity: done ? 0.75 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
      transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
      className={cn(
        'rounded-card border transition-[box-shadow,background-color,border-color]',
        done
          ? 'border-dashed border-border/70 bg-muted p-2.5'
          : cn(ELEVATED_CARD, ELEVATED_CARD_HOVER, 'p-4'),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <motion.div layout="position" className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              className={cn(
                'flex min-w-0 items-baseline font-black tracking-tight transition-colors',
                done
                  ? 'text-sm text-muted-foreground'
                  : 'text-base text-foreground',
              )}
            >
              {emoji ? (
                <span aria-hidden className="mr-1.5 shrink-0">
                  {emoji}
                </span>
              ) : null}
              {/* Shrinks long names to fit instead of ellipsizing; refitKey
                  re-measures when `done` swaps the h4 font size. */}
              <FitText minFontPx={12} refitKey={done} className="text-ellipsis">
                {item.name}
              </FitText>
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
                        ? { boxShadow: `0 0 0 2px ${personColorValue(p?.color)}` }
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
              className="flex shrink-0 items-center gap-1.5 text-primary-strong"
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
                  onClick={() => {
                    tapHaptic([8, 30, 8])
                    onShareEvenly(
                      item.id,
                      sharePeople.map((p) => p.id),
                    )
                  }}
                  className="grid size-10 place-items-center rounded-full text-muted-foreground transition-[scale,color,background-color] hover:bg-muted hover:text-foreground active:scale-[0.96]"
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
                  className="grid size-10 place-items-center rounded-full border border-border transition-[scale,background-color] hover:bg-muted active:scale-[0.96] disabled:opacity-30"
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
                  className="grid size-10 place-items-center rounded-full border border-border transition-[scale,background-color,opacity] hover:bg-muted active:scale-[0.96] disabled:opacity-30"
                  style={
                    activePerson && remaining > 0.0001
                      ? {
                          backgroundColor: personColorValue(activePerson.color),
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
}
