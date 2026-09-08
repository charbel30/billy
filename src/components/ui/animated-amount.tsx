import { useEffect } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
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
  const reducedMotion = useReducedMotion()
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 })
  useEffect(() => {
    if (reducedMotion) spring.jump(value)
    else spring.set(value)
  }, [value, spring, reducedMotion])
  const text = useTransform(spring, (v) => format(v))
  if (reducedMotion) return <span className={cn('font-receipt', className)}>{format(value)}</span>
  return <motion.span className={cn('font-receipt', className)}>{text}</motion.span>
}
