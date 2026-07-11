import { motion } from 'motion/react'
import { fadeRise } from '~/lib/ui'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { howItWorksCopy } from '../content'

export function HowItWorksSection() {
  return (
    <motion.section
      initial={fadeRise.initial}
      whileInView={fadeRise.animate}
      transition={fadeRise.transition}
      viewport={{ once: true, amount: 0.3 }}
      className="flex flex-col gap-6"
    >
      <h2 className="text-2xl font-bold tracking-tight text-balance">
        {howItWorksCopy.title}
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {howItWorksCopy.steps.map((step, i) => (
          <Card key={step.title}>
            <CardHeader>
              <div className="font-receipt text-primary-strong">
                {String(i + 1).padStart(2, '0')}
              </div>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {step.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.section>
  )
}
