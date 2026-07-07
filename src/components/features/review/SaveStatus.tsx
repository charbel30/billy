import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiCheckLine, RiLoader4Line } from '@remixicon/react'
import { swap } from '~/lib/animations'

// "Saving… ⇄ Saved" chip for the review editor's debounced autosave: shows a
// spinner while a flush is in flight, then a brief check when it lands.
export function SaveStatus({ saving }: { saving: boolean }) {
  const [showSaved, setShowSaved] = useState(false)
  const wasSaving = useRef(false)

  useEffect(() => {
    const was = wasSaving.current
    wasSaving.current = saving
    if (was && !saving) {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 1600)
      return () => clearTimeout(t)
    }
  }, [saving])

  if (!saving && !showSaved) return null

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
      <AnimatePresence mode="popLayout" initial={false}>
        {saving ? (
          <motion.span key="saving" {...swap} className="inline-flex items-center gap-1.5">
            <RiLoader4Line className="size-3.5 animate-spin" />
            Saving
          </motion.span>
        ) : (
          <motion.span
            key="saved"
            {...swap}
            className="inline-flex items-center gap-1.5 text-success-subtle-foreground"
          >
            <RiCheckLine className="size-3.5" />
            Saved
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
