import { useId, useState } from 'react'
import { motion } from 'motion/react'
import { RiAddLine, RiCheckLine, RiGroupLine, RiSubtractLine } from '@remixicon/react'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useCurrencyDisplay } from '~/hooks/useCurrencyDisplay'
import type { ShareItemEvenly } from '~/lib/bill'
import { personColorValue } from '~/lib/bill'
import { formatUnits } from '~/lib/format'
import { effectiveUnitPrice, formatLbp, formatUsd, remainingUnits, toUsd } from '~/lib/money'
import type { Claim, LineItem, Person } from '~/lib/types'
import { cn } from '~/lib/utils'
import { PersonAvatar } from '../people'

const quantityText = (value: number) => String(Number(value.toFixed(8)))

function ordersLabel(n: number) {
  const abs = Math.abs(n)
  const singular = abs > 0 && abs <= 1 + 1e-8
  return `${formatUnits(n)} ${singular ? 'order' : 'orders'}`
}

function SharePrice({
  lbp,
  rate,
}: {
  lbp: number
  rate: number | null | undefined
}) {
  const { display } = useCurrencyDisplay()
  const hasRate = Boolean(rate)
  const lbpPrimary = display === 'lbp' || !hasRate
  const showBoth = display === 'both' && hasRate
  return (
    <div className="text-right">
      <AnimatedAmount
        value={lbpPrimary ? lbp : toUsd(lbp, rate)}
        format={lbpPrimary ? formatLbp : formatUsd}
        className="block text-lg font-bold tracking-tight text-primary-strong"
      />
      {showBoth ? (
        <AnimatedAmount
          value={lbp}
          format={formatLbp}
          className="mt-0.5 block text-[10px] font-semibold text-muted-foreground"
        />
      ) : null}
    </div>
  )
}

/** Add shares of a chosen quantity without redistributing any existing claims. */
export function ItemOrderSplit({
  item, claims, people, activePerson, rate, restricted, onClose, onSave, onSaved,
}: {
  item: LineItem
  claims: Claim[]
  people: Person[]
  activePerson: Person | null
  rate: number | null | undefined
  restricted: boolean
  onClose: () => void
  onSave: ShareItemEvenly
  onSaved: (undo: () => Promise<void>) => void
}) {
  const quantityId = useId()
  const available = remainingUnits(item, claims)
  const [quantityInput, setQuantityInput] = useState(() => quantityText(available))
  const [selected, setSelected] = useState(() => new Set(people.map((person) => person.id)))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orderedPeople = activePerson && people.some((person) => person.id === activePerson.id)
    ? [activePerson, ...people.filter((person) => person.id !== activePerson.id)]
    : people
  const selectedIds = people.filter((p) => selected.has(p.id)).map((p) => p.id)
  const count = selectedIds.length
  const quantity = Number(quantityInput)
  const validQuantity = Number.isFinite(quantity) && quantity > 0 && quantity <= available + 1e-8
  const ready = count >= 2 && validQuantity
  const units = ready ? Math.min(quantity, available) / count : 0
  const allSelected = people.length > 0 && count === people.length
  const belowMax = validQuantity && quantity < available - 1e-8
  const shareLbp = units * effectiveUnitPrice(item)

  function togglePerson(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    if (pending || !ready) return
    setPending(true)
    setError(null)
    try {
      const undo = await onSave(item.id, selectedIds, quantity)
      onSaved(undo)
      onClose()
    } catch {
      setError('Could not split these orders. Check how many are left and try again.')
    } finally {
      setPending(false)
    }
  }

  const hint = available <= 1e-8
    ? 'Nothing left to split.'
    : !validQuantity
      ? `Up to ${ordersLabel(available)} left.`
      : count === 0
        ? 'Pick who shares.'
        : count === 1
          ? 'Pick one more person.'
          : null

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
      aria-label={`Split orders of ${item.name}`}
      aria-busy={pending}
      onSubmit={(event) => { event.preventDefault(); void save() }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
      className="mt-3 space-y-3 border-t border-border/60 pt-3"
    >
      <fieldset disabled={pending} className="space-y-3">
        <legend className="sr-only">Choose orders and people</legend>

        <div>
          <p className="text-sm font-bold">Who</p>
          {restricted ? (
            <p className="text-xs text-pretty text-muted-foreground">The people you added.</p>
          ) : null}
          <div className="mt-2 space-y-2">
            {!allSelected && people.length > 2 ? (
              <button
                type="button"
                onClick={() => setSelected(new Set(people.map((person) => person.id)))}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-muted/60 text-sm font-bold ring-1 ring-border transition-[scale,background-color] hover:bg-muted active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring"
              >
                <RiGroupLine className="size-4" aria-hidden />
                Everyone
              </button>
            ) : null}
            <div role="group" aria-label="People who share" className="grid grid-cols-2 gap-2">
              {orderedPeople.map((person) => {
                const checked = selected.has(person.id)
                return (
                  <label
                    key={person.id}
                    className={cn(
                      'flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full px-2.5 py-1.5 text-sm transition-[scale,background-color,box-shadow] active:scale-[0.96] has-focus-visible:outline-2 has-focus-visible:outline-ring',
                      checked ? 'bg-background' : 'bg-muted/60 ring-1 ring-border hover:bg-muted',
                      pending && 'pointer-events-none opacity-60',
                    )}
                    style={
                      checked
                        ? { boxShadow: `0 0 0 2px ${personColorValue(person.color)}` }
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      aria-label={person.name}
                      className="sr-only"
                      checked={checked}
                      onChange={() => togglePerson(person.id)}
                    />
                    <PersonAvatar name={person.name} color={person.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{person.name}</span>
                    {checked ? <RiCheckLine className="size-4 shrink-0" aria-hidden /> : null}
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {available > 1 + 1e-8 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor={quantityId} className="text-sm font-bold">How many</label>
              <p id={`${quantityId}-hint`} className="text-xs text-muted-foreground tabular-nums">
                {ordersLabel(available)} left
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon-lg"
                variant="outline"
                aria-label="Split fewer orders"
                disabled={!Number.isFinite(quantity) || quantity <= Math.min(1, available)}
                onClick={() => setQuantityInput(quantityText(Math.max(Math.min(1, available), quantity - 1)))}
              >
                <RiSubtractLine aria-hidden />
              </Button>
              <Input
                id={quantityId}
                type="number"
                inputMode="decimal"
                min="0"
                max={available + 1e-8}
                step="any"
                value={quantityInput}
                onChange={(event) => { setQuantityInput(event.target.value); setError(null) }}
                aria-describedby={`${quantityId}-hint`}
                aria-invalid={!validQuantity}
                className="h-10 w-16 rounded-full px-1 text-center font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                type="button"
                size="icon-lg"
                variant="outline"
                aria-label="Split more orders"
                disabled={!Number.isFinite(quantity) || quantity >= available - 1e-8}
                onClick={() => setQuantityInput(quantityText(Math.min(available, quantity + 1)))}
              >
                <RiAddLine aria-hidden />
              </Button>
              {belowMax ? (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="px-2.5"
                  onClick={() => setQuantityInput(quantityText(available))}
                >
                  All
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p id={`${quantityId}-hint`} className="sr-only">{ordersLabel(available)} left</p>
        )}
      </fieldset>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex min-h-16 items-center justify-between gap-3 rounded-control bg-muted/60 px-4 py-3"
      >
        {ready ? (
          <>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Each person</p>
              <p className="text-sm font-bold tabular-nums text-pretty">{ordersLabel(units)}</p>
            </div>
            <SharePrice lbp={shareLbp} rate={rate} />
          </>
        ) : (
          <p className="text-sm text-pretty text-muted-foreground">{hint}</p>
        )}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending || !ready}
        className="h-11 w-full font-bold active:scale-[0.96]"
      >
        <span className="truncate">
          {pending ? 'Splitting…' : validQuantity ? `Split ${ordersLabel(quantity)}` : 'Split orders'}
        </span>
      </Button>
    </motion.form>
  )
}
