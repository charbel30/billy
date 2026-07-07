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
