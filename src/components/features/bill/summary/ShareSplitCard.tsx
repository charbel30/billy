import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import {
  RiFullscreenLine,
  RiLinkUnlinkM,
  RiShareLine,
  RiCheckLine,
} from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { Brand } from '~/components/shared/Brand'
import { swap } from '~/lib/ui'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog'

// Share surface for a published split: QR for the table ("scan this"), one
// share button for chats (native sheet → clipboard fallback), a fullscreen
// "present" mode for table stands / staff phones, and revoke for leaked links.
// Used inline on the summary screen and inside a dialog on the split screen.
export function ShareSplitCard({
  url,
  merchantName,
  onRevoke,
}: {
  url: string
  merchantName: string
  onRevoke?: () => Promise<void> | void
}) {
  const [revoking, setRevoking] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const presentButtonRef = useRef<HTMLButtonElement>(null)
  const [sharing, setSharing] = useState(false)
  const [feedback, setFeedback] = useState<'copied' | 'shared' | null>(null)

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 2200)
    return () => clearTimeout(timer)
  }, [feedback])

  async function share() {
    if (sharing) return
    setSharing(true)
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: `${merchantName || 'Join the split'} — Spolio`,
            text: 'Pick what you had and see your share in dollars and lira.',
            url,
          })
          setFeedback('shared')
          return
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }
      try {
        await navigator.clipboard.writeText(url)
        setFeedback('copied')
        toast.success('Split link copied')
      } catch {
        toast(url)
      }
    } finally {
      setSharing(false)
    }
  }

  async function revoke() {
    if (!onRevoke) return
    const confirmed = window.confirm(
      'Revoke this link? The current link stops working for everyone; sharing again creates a fresh one.',
    )
    if (!confirmed) return
    setRevoking(true)
    try {
      await onRevoke()
      toast.success('Link revoked')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Intentionally literal white (not bg-card): the QR must stay
          dark-on-light for phone cameras to scan it in dark mode too. */}
      <div className="mx-auto w-fit rounded-card bg-white p-4 shadow-card outline outline-black/10 dark:outline-white/10">
        <QRCodeSVG value={url} size={184} marginSize={1} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Point a phone camera at the code, or send the link.
      </p>

      <Button size="lg" className="h-12 w-full gap-2 font-bold" disabled={sharing} aria-busy={sharing} onClick={() => void share()}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={feedback ? 'done' : 'share'} {...swap} className="grid size-5 place-items-center" aria-hidden="true">
            {feedback ? <RiCheckLine className="size-5" /> : <RiShareLine className="size-5" />}
          </motion.span>
        </AnimatePresence>
        {feedback === 'copied' ? 'Link copied' : feedback === 'shared' ? 'Link shared' : 'Share link'}
      </Button>
      <span role="status" className="sr-only">{feedback === 'copied' ? 'Split link copied. Paste it in your group chat.' : feedback === 'shared' ? 'Split link shared.' : ''}</span>

      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          ref={presentButtonRef}
          onClick={() => setPresenting(true)}
          className="min-h-11 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RiFullscreenLine className="mr-1 inline size-3.5 align-[-2px]" />
          Present at the table
        </button>
        {onRevoke ? (
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={revoking}
            className="min-h-11 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RiLinkUnlinkM className="mr-1 inline size-3.5 align-[-2px]" />
            Revoke this link
          </button>
        ) : null}
      </div>

      <Dialog open={presenting} onOpenChange={setPresenting}>
        <DialogContent
          finalFocus={presentButtonRef}
          className="share-present inset-0 start-0 top-0 z-[60] flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-5 overflow-y-auto rounded-none bg-white px-6 py-16 text-center text-[#202820] sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100 [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:bg-neutral-100 [&_[data-slot=dialog-close]]:text-neutral-700"
        >
          <Brand className="text-[#202820]" />
          <DialogTitle className="text-2xl font-extrabold tracking-tight">
            {merchantName || 'Join the split'}
          </DialogTitle>
          {/* Literal dark-on-white contrast keeps the code scannable in both themes. */}
          <QRCodeSVG
            value={url}
            size={720}
            marginSize={2}
            className="h-auto w-[min(74vw,50dvh)] shrink-0 rounded-card"
          />
          <DialogDescription className="text-base font-semibold text-neutral-600">
            Scan to join the split
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  )
}
