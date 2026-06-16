import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { cn } from '~/lib/utils'

// A number that smoothly counts to its target — the "totals tick" feel from
// ui-flow-vision.md. `format` turns the in-flight number into the display string
// (e.g. formatLbp / formatUsd) so the currency formatting rides along.
export function AnimatedAmount({
  value,
  format,
  className,
}: {
  value: number
  format: (n: number) => string
  className?: string
}) {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 })
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  const text = useTransform(spring, (v) => format(v))
  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>
}
