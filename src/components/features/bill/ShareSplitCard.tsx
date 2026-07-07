import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import {
  RiCloseLine,
  RiFullscreenLine,
  RiLinkUnlinkM,
  RiShareLine,
} from '@remixicon/react'
import { Button } from '~/components/ui/button'

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

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Split: ${merchantName || 'the bill'}`,
          text: 'Join the split and claim your items',
          url,
        })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Split link copied')
    } catch {
      toast(url)
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

  useEffect(() => {
    if (!presenting) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresenting(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [presenting])

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

      <Button size="lg" className="w-full" onClick={() => void share()}>
        <RiShareLine />
        Share link
      </Button>

      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => setPresenting(true)}
          className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <RiFullscreenLine className="mr-1 inline size-3.5 align-[-2px]" />
          Present at the table
        </button>
        {onRevoke ? (
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={revoking}
            className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
          >
            <RiLinkUnlinkM className="mr-1 inline size-3.5 align-[-2px]" />
            Revoke this link
          </button>
        ) : null}
      </div>

      {/* Fullscreen "present" takeover for table stands / a staff phone laid on
          the table. Portaled to <body>: DialogContent's centering transform
          would otherwise capture this fixed overlay. Always white for QR
          contrast, so text colors are explicit rather than themed. */}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {presenting ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                  onClick={() => setPresenting(false)}
                  className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-6 bg-white px-6"
                >
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setPresenting(false)}
                    className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-neutral-100 text-neutral-500 transition-[transform,background-color] hover:bg-neutral-200 active:scale-[0.96]"
                  >
                    <RiCloseLine className="size-6" />
                  </button>
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
                    className="flex flex-col items-center gap-6 text-center"
                  >
                    <h2 className="text-2xl font-black tracking-tight text-neutral-900 [text-wrap:balance]">
                      {merchantName || 'Join the split'}
                    </h2>
                    <QRCodeSVG
                      value={url}
                      size={720}
                      marginSize={2}
                      className="h-auto w-[min(78vw,58vh)] rounded-card"
                    />
                    <p className="text-base font-semibold text-neutral-500">
                      Scan to join the split
                    </p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  )
}
