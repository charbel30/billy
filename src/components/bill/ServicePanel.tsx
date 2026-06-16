import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { WorkingMeta } from '~/hooks/useBillEditor'
import { Switch } from '~/components/ui/switch'
import { cn } from '~/lib/utils'

// Service charge / tax are OFF by default and collapsed (ui-flow-vision.md). The
// switch reveals the amounts and the even/proportional split mode.

function num(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function MiniField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (n: number) => void
}) {
  const initial = String(value)
  const [draft, setDraft] = useState(initial)
  useEffect(() => setDraft(initial), [initial])
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== initial && onCommit(num(draft))}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground tabular-nums outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

export function ServicePanel({
  meta,
  onChange,
}: {
  meta: WorkingMeta
  onChange: (patch: Partial<WorkingMeta>) => void
}) {
  const on = meta.serviceChargeOn
  return (
    <div className="rounded-xl border border-border p-3">
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Service &amp; tax</span>
          <span className="block text-xs text-muted-foreground">
            Off by default — turn on to add and distribute it
          </span>
        </span>
        <Switch
          checked={on}
          onCheckedChange={(checked) => onChange({ serviceChargeOn: checked })}
        />
      </label>

      <AnimatePresence initial={false}>
        {on && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniField
                label="Service (LL)"
                value={meta.serviceCharge}
                onCommit={(n) => onChange({ serviceCharge: n })}
              />
              <MiniField
                label="Tax (LL)"
                value={meta.tax}
                onCommit={(n) => onChange({ tax: n })}
              />
            </div>
            <div className="mt-3 flex rounded-lg border border-border p-0.5 text-xs">
              {(['proportional', 'even'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ serviceSplitMode: mode })}
                  className={cn(
                    'flex-1 rounded-md py-1 capitalize transition-colors',
                    meta.serviceSplitMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
