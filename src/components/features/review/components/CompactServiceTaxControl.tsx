import { Switch } from '~/components/ui/switch'
import { BlurCommitInput } from '~/components/ui/blur-commit-input'
import { formatLbpCompact, parseNumericInput } from '~/lib/format'
import type { WorkingMeta } from '~/lib/bill/types'

export function CompactServiceTaxControl({
  meta,
  onChange,
  readOnly = false,
}: {
  meta: WorkingMeta
  onChange: (patch: Partial<WorkingMeta>) => void
  readOnly?: boolean
}) {
  const on = meta.serviceChargeOn
  return (
    <div className="surface-inset p-3 ring-1 ring-border/50">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Service &amp; tax</p>
          <p className="text-xs text-muted-foreground">
            {on ? 'Included in total' : 'Not added'}
          </p>
        </div>
        {readOnly ? null : (
          <Switch
            checked={on}
            onCheckedChange={(checked) => onChange({ serviceChargeOn: checked })}
          />
        )}
      </div>

      {on ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {readOnly ? (
            <>
              <StaticMoneyField label="Service" value={meta.serviceCharge} />
              <StaticMoneyField label="Tax" value={meta.tax} />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function StaticMoneyField({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-muted/60 px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block text-right text-sm font-black tabular-nums">
        {formatLbpCompact(value)} LBP
      </span>
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
