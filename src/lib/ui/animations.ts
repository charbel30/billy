// Shared motion presets (values from the make-interfaces-feel-better skill).

// Contextual swap: two states morphing in place (claim controls ⇄ done check,
// idle ⇄ busy button icon). Spread onto a motion element inside AnimatePresence.
export const swap = {
  initial: { opacity: 0, scale: 0.25, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.25, filter: 'blur(4px)' },
  transition: { type: 'spring' as const, duration: 0.3, bounce: 0 },
}

// Sliding active-pill in segmented controls (header step nav).
export const pillSpring = {
  type: 'spring' as const,
  duration: 0.4,
  bounce: 0.15,
}

// Page/section enter: rise + unblur. Exits (softExit) are softer than enters.
export const fadeRise = {
  initial: { opacity: 0, y: 10, filter: 'blur(2px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { type: 'spring' as const, duration: 0.45, bounce: 0 },
}

export const softExit = { opacity: 0, y: 4 }

// Variants pair for staggered list/hero entrances:
// <motion.div variants={staggerContainer} initial="hidden" animate="show">
//   <motion.div variants={staggerChild} />…
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

export const staggerChild = {
  hidden: { opacity: 0, y: 10, filter: 'blur(2px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.45, bounce: 0 },
  },
}

// Tap feedback for motion buttons; non-motion buttons use the CSS equivalent
// `active:scale-[0.96] transition-transform`.
export const press = {
  whileTap: { scale: 0.96 },
  transition: { type: 'spring' as const, duration: 0.25, bounce: 0 },
}

// Bottom sheet / disclosure open-close (mobile dock, rate field).
export const sheetSpring = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 38,
}

// New element popping into a collection (person pill just added).
export const popIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring' as const, duration: 0.35, bounce: 0.15 },
}
