import { useState } from 'react'
import { motion } from 'motion/react'
import { BottomSheet } from '~/components/ui/bottom-sheet'
import { reviewCopy } from '../content'

/**
 * "Compare with photo": the scanned receipt, shrunk into the header. It is the
 * local object URL and nothing else — the server deletes the image right after
 * extraction — so it lives for this visit only and says so when opened.
 */
export function ReceiptPhotoThumb({ previewUrl }: { previewUrl: string }) {
  const [open, setOpen] = useState(false)
  const copy = reviewCopy.photoThumb

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={copy.label}
        title={copy.label}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-transform active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-ring"
      >
        <motion.img
          layoutId="receipt-photo"
          src={previewUrl}
          alt=""
          className="h-7 w-5 rounded-sm object-cover"
        />
        <span>Photo</span>
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={copy.title}
        description={copy.disclosure}
        responsive
      >
        <img
          src={previewUrl}
          alt={reviewCopy.processing.photoAlt}
          className="mx-auto block max-h-[70dvh] w-full rounded-card object-contain"
        />
      </BottomSheet>
    </>
  )
}
