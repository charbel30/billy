import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import {
  RiFileCopyLine,
  RiLinkUnlinkM,
  RiShareLine,
} from '@remixicon/react'
import { Button } from '~/components/ui/button'

// Share surface for a published split: QR for the table ("scan this"), native
// share / copy for chats, and revoke for leaked links. Used inline on the
// summary screen and inside a dialog on the split screen.
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
    await copy()
  }

  async function copy() {
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

  return (
    <div className="space-y-4">
      <div className="mx-auto w-fit rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.05)] ring-1 ring-border/40">
        <QRCodeSVG value={url} size={184} marginSize={1} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Point a phone camera at the code, or send the link.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button size="lg" className="w-full" onClick={() => void share()}>
          <RiShareLine />
          Share link
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => void copy()}
          aria-label="Copy link"
        >
          <RiFileCopyLine />
        </Button>
      </div>

      {onRevoke ? (
        <button
          type="button"
          onClick={() => void revoke()}
          disabled={revoking}
          className="mx-auto block rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
        >
          <RiLinkUnlinkM className="mr-1 inline size-3.5 align-[-2px]" />
          Revoke this link
        </button>
      ) : null}
    </div>
  )
}
