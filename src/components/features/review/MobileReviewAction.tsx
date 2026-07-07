import { RiArrowRightLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { formatUsd, toUsd } from '~/lib/currency'
import { formatLbpCompact } from '~/lib/format'

export function MobileReviewAction({
  total,
  rate,
  canContinue,
  onContinue,
}: {
  total: number
  rate: number | null | undefined
  canContinue: boolean
  onContinue: () => Promise<void>
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-4 pt-8 lg:hidden">
      <div className="rounded-card bg-muted/95 p-3 shadow-dock ring-1 ring-border/60 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between rounded-[1.6rem] bg-background/75 px-4 py-3">
          <span className="text-sm font-black text-muted-foreground">Total</span>
          <div className="text-right leading-none">
            <AnimatedAmount
              value={toUsd(total, rate)}
              format={formatUsd}
              className="block text-3xl font-black tracking-tight text-primary-strong"
            />
            <AnimatedAmount
              value={total}
              format={formatLbpCompact}
              className="mt-1 block text-xs font-bold text-primary-strong/80"
            />
          </div>
        </div>
        <Button
          size="lg"
          className="h-[3.25rem] w-full text-base shadow-raised"
          disabled={!canContinue}
          onClick={() => void onContinue()}
        >
          Proceed to split
          <RiArrowRightLine />
        </Button>
      </div>
    </div>
  )
}
