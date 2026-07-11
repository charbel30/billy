import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useCreateDemoBill } from '~/api'
import { getDeviceId } from '~/lib/session'
import { staggerChild, staggerContainer } from '~/lib/ui'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { heroCopy } from '../content'

export function HeroSection() {
  const navigate = useNavigate()
  const createDemoBill = useCreateDemoBill()
  const isPending = createDemoBill.isPending

  async function trySampleBill() {
    if (isPending) return
    try {
      const billId = await createDemoBill.mutateAsync({
        deviceId: getDeviceId(),
      })
      navigate({ to: '/review/$billId', params: { billId } })
    } catch {
      // Global MutationCache.onError toasts every mutation error.
    }
  }

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center"
    >
      <motion.div variants={staggerChild}>
        <Badge variant="secondary">{heroCopy.badge}</Badge>
      </motion.div>

      <motion.h1
        variants={staggerChild}
        className="text-4xl font-black tracking-tight text-balance sm:text-5xl"
      >
        {heroCopy.headline}
      </motion.h1>

      <motion.p
        variants={staggerChild}
        className="text-pretty text-muted-foreground"
      >
        {heroCopy.subhead}
      </motion.p>

      <motion.div
        variants={staggerChild}
        className="flex flex-col justify-center gap-3 sm:flex-row"
      >
        <Button size="lg" render={<Link to="/scan" />}>
          {heroCopy.primaryCta}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={isPending}
          onClick={() => void trySampleBill()}
        >
          {heroCopy.secondaryCta}
        </Button>
      </motion.div>
    </motion.section>
  )
}
