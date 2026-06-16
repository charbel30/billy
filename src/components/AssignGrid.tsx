import { cn } from '~/lib/utils'
import { formatLbp, formatUsd, toUsd } from '~/lib/currency'
import type { Doc, Id } from 'convex/_generated/dataModel'

// Tap an item onto people to assign it; multiple assignees = a shared item that
// splits equally (spec §6.1, §8.2 AssignGrid).
export function AssignGrid({
  lineItems,
  people,
  assignments,
  rate,
  onToggle,
}: {
  lineItems: Doc<'lineItems'>[]
  people: Doc<'people'>[]
  assignments: Doc<'assignments'>[]
  rate: number | null | undefined
  onToggle: (lineItemId: Id<'lineItems'>, personId: Id<'people'>) => void
}) {
  function assigneesOf(lineItemId: Id<'lineItems'>) {
    return new Set(
      assignments
        .filter((a) => a.lineItemId === lineItemId)
        .map((a) => a.personId),
    )
  }

  return (
    <div className="space-y-2">
      {lineItems.map((li) => {
        const assigned = assigneesOf(li._id)
        return (
          <div key={li._id} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-medium">
                {li.qty}× {li.name}
              </div>
              <div className="text-sm tabular-nums">
                {formatLbp(li.lineTotal)}
                {rate ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · {formatUsd(toUsd(li.lineTotal, rate))}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const on = assigned.has(p._id)
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => onToggle(li._id, p._id)}
                    className={cn(
                      'rounded-3xl border px-2.5 py-1 text-xs font-medium transition-colors',
                      on
                        ? 'border-transparent text-white'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                    style={on ? { backgroundColor: p.color } : undefined}
                  >
                    {p.name}
                  </button>
                )
              })}
              {people.length === 0 && (
                <span className="text-xs text-muted-foreground">Add people first.</span>
              )}
            </div>

            {assigned.size > 1 && (
              <div className="text-xs text-muted-foreground">
                Shared — split {assigned.size} ways
              </div>
            )}
            {assigned.size === 0 && people.length > 0 && (
              <div className="text-xs text-amber-600">Unassigned</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
