import { motion } from 'motion/react'
import { RiWhatsappLine } from '@remixicon/react'
import { fadeRise } from '~/lib/ui'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { venueCopy, venueWhatsAppUrl } from '../content'

export function VenueSection() {
  return (
    <motion.section
      initial={fadeRise.initial}
      whileInView={fadeRise.animate}
      transition={fadeRise.transition}
      viewport={{ once: true, amount: 0.3 }}
    >
      <Card className="ring-primary/25">
        <CardContent className="flex flex-col items-start gap-4">
          <Badge>{venueCopy.badge}</Badge>
          <h2 className="text-2xl font-bold tracking-tight text-balance">
            {venueCopy.title}
          </h2>
          <p className="text-pretty text-muted-foreground">{venueCopy.body}</p>
          <Button
            render={
              <a
                href={venueWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <RiWhatsappLine />
            {venueCopy.cta}
          </Button>
        </CardContent>
      </Card>
    </motion.section>
  )
}
