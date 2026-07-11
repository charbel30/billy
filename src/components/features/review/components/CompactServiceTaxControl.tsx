import { Switch } from '~/components/ui/switch'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { parseNumericInput } from '~/lib/format'
import type { WorkingMeta } from '~/lib/bill/types'

export function CompactServiceTaxControl({
  meta,
  onChange,
}: {
  meta: WorkingMeta
  onChange: (patch: Partial<WorkingMeta>) => void
}) {
  const on = meta.serviceChargeOn
  return (
    <div className="mt-5 rounded-card bg-background/65 p-3 ring-1 ring-border/50">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Service &amp; tax</p>
          <p className="text-xs text-muted-foreground">
            {on ? 'Included in total' : 'Not added'}
          </p>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(checked) => onChange({ serviceChargeOn: checked })}
        />
      </div>

      {on ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <CompactMoneyField
            label="Service"
            value={meta.serviceCharge}
            onCommit={(serviceCharge) => onChange({ serviceCharge })}
          />
          <CompactMoneyField
            label="Tax"
            value={meta.tax}
            onCommit={(tax) => onChange({ tax })}
          />
        </div>
      ) : null}
    </div>
  )
}

function CompactMoneyField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  return (
    <label className="rounded-control bg-muted/60 px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <BlurCommitInput
        numeric
        value={value}
        onCommit={(raw) => onCommit(parseNumericInput(raw))}
        align="right"
        className="mt-0.5 w-full text-right text-sm font-black tabular-nums"
      />
    </label>
  )
}
