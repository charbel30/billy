import { motion } from 'motion/react'
import { fadeRise } from '~/lib/ui'
import { Card, CardContent } from '~/components/ui/card'
import { Separator } from '~/components/ui/separator'
import { dualCurrencyCopy } from '../content'

export function DualCurrencySection() {
  const { receiptDemo } = dualCurrencyCopy

  return (
    <motion.section
      initial={fadeRise.initial}
      whileInView={fadeRise.animate}
      transition={fadeRise.transition}
      viewport={{ once: true, amount: 0.3 }}
      className="grid gap-8 md:grid-cols-2 md:items-center"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-balance">
          {dualCurrencyCopy.title}
        </h2>
        <p className="text-pretty text-muted-foreground">
          {dualCurrencyCopy.body}
        </p>
      </div>

      <Card>
        <CardContent className="font-receipt tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{receiptDemo.lbpLabel}</span>
            <span>{receiptDemo.lbpValue}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">{receiptDemo.usdLabel}</span>
            <span>{receiptDemo.usdValue}</span>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-between text-primary-strong">
            <span>{receiptDemo.rateLabel}</span>
            <span>{receiptDemo.rateValue}</span>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  )
}
