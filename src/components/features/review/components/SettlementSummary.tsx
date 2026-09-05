import { RiArrowRightLine, RiReceiptLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { formatUsd, toUsd } from '~/lib/money'
import { formatLbpCompact } from '~/lib/format'
import type { WorkingMeta } from '~/lib/bill/types'
import { CompactServiceTaxControl } from './CompactServiceTaxControl'

export function SettlementSummary({
  total,
  rate,
  meta,
  onMetaChange,
  canContinue,
  onContinue,
  readOnly = false,
}: {
  total: number
  rate: number | null | undefined
  meta: WorkingMeta
  onMetaChange: (patch: Partial<WorkingMeta>) => void
  canContinue: boolean
  onContinue: () => Promise<void>
  readOnly?: boolean
}) {
  return (
    <aside className="hidden lg:sticky lg:top-24 lg:block">
      <section className="rounded-card bg-muted/80 p-5 shadow-raised ring-1 ring-border/40 backdrop-blur sm:p-6">
        <h2 className="mb-5 flex items-center gap-2 text-base font-black">
          <RiReceiptLine className="size-5" />
          Settlement summary
        </h2>

        <div className="flex items-end justify-between">
          <span className="text-3xl font-black tracking-tight">Total</span>
          <div className="text-right">
            <AnimatedAmount
              value={toUsd(total, rate)}
              format={formatUsd}
              className="block text-4xl font-black tracking-tight text-primary-strong"
            />
            <AnimatedAmount
              value={total}
              format={formatLbpCompact}
              className="block text-sm font-semibold text-primary-strong/80"
            />
          </div>
        </div>

        <CompactServiceTaxControl
          meta={meta}
          onChange={onMetaChange}
          readOnly={readOnly}
        />

        {readOnly ? null : (
          <Button
            size="lg"
            className="mt-6 h-14 w-full text-base shadow-raised"
            disabled={!canContinue}
            onClick={() => void onContinue()}
          >
            Proceed to split
            <RiArrowRightLine />
          </Button>
        )}
      </section>
    </aside>
  )
}
