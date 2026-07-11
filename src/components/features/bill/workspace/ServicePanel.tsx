import { AnimatePresence, motion } from 'motion/react'
import type { WorkingMeta } from '~/lib/bill/types'
import { Switch } from '~/components/ui/switch'
import { cn } from '~/lib/utils'
import { parseNumericInput } from '~/lib/format'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'

// Service charge / tax are OFF by default and collapsed (ui-flow-vision.md). The
// switch reveals the amounts and the even/proportional split mode.

function MiniField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <BlurCommitInput
        numeric
        value={value}
        onCommit={(raw) => onCommit(parseNumericInput(raw))}
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
                    'flex-1 rounded-md py-1 capitalize transition-[scale,background-color,color] active:scale-[0.96]',
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
