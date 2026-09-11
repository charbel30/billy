import { useEffect, useRef } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { cn } from '~/lib/utils'

// A number that smoothly counts to its target — the "totals tick" feel from
// ui-flow-vision.md. `format` turns the in-flight number into the display string
// (e.g. formatLbp / formatUsd) so the currency formatting rides along.
export function AnimatedAmount({
  value,
  format,
  className,
  initialValue,
  initialDelayMs,
}: {
  value: number
  format: (n: number) => string
  className?: string
  /** Start somewhere else and count to `value` on mount (reveal: from 0). */
  initialValue?: number
  /** Hold that first count until the element it lives in has arrived. */
  initialDelayMs?: number
}) {
  const reducedMotion = useReducedMotion()
  const spring = useSpring(initialValue ?? value, {
    stiffness: 140,
    damping: 22,
    mass: 0.6,
  })
  const pending = useRef(true)
  useEffect(() => {
    const delay = pending.current ? (initialDelayMs ?? 0) : 0
    pending.current = false
    if (reducedMotion) {
      spring.jump(value)
      return
    }
    if (!delay) {
      spring.set(value)
      return
    }
    const timer = setTimeout(() => spring.set(value), delay)
    return () => clearTimeout(timer)
  }, [value, spring, reducedMotion, initialDelayMs])
  const text = useTransform(spring, (v) => format(v))
  if (reducedMotion) return <span className={cn('font-receipt', className)}>{format(value)}</span>
  return <motion.span className={cn('font-receipt', className)}>{text}</motion.span>
}
