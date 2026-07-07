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
      <div className="rounded-[2rem] bg-muted/95 p-3 shadow-[0_-18px_54px_rgba(0,0,0,0.10)] ring-1 ring-border/60 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between rounded-[1.6rem] bg-background/75 px-4 py-3">
          <span className="text-sm font-black text-muted-foreground">Total</span>
          <div className="text-right leading-none">
            <AnimatedAmount
              value={toUsd(total, rate)}
              format={formatUsd}
              className="block text-3xl font-black tracking-tight text-primary"
            />
            <AnimatedAmount
              value={total}
              format={formatLbpCompact}
              className="mt-1 block text-xs font-bold text-primary/80"
            />
          </div>
        </div>
        <Button
          size="lg"
          className="h-[3.25rem] w-full text-base shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
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
