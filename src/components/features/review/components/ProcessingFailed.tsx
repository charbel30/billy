import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { RiCameraLine, RiLoader4Line } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { reviewCopy } from '../content'
import { ScanPhoto } from './ProcessingScreen'

/**
 * The two ways the scan wait ends badly, on the same full-screen frame as
 * `ProcessingScreen`: the receipt could not be read, or the upload never
 * finished (a reload mid-flight). Never a dead end — scan again into the same
 * bill, or type the items in.
 */
export function ProcessingFailed({
  variant,
  previewUrl,
  message,
  onRescan,
  onEnterManually,
  busy = false,
}: {
  variant: 'failed' | 'photo-lost'
  previewUrl: string | null
  /** Server/rate-limit wording, shown verbatim when it adds something. */
  message: string | null
  onRescan: (file: File) => void
  onEnterManually: () => void
  busy?: boolean
}) {
  const copy = reviewCopy.processing
  const inputRef = useRef<HTMLInputElement>(null)
  const title = variant === 'failed' ? copy.failedTitle : copy.photoLostTitle
  const body = variant === 'failed' ? copy.failedBody : copy.photoLostBody

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // Allow choosing the same photo again.
    if (!file) return
    onRescan(file)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 pb-10 pt-2 text-center sm:px-6">
      <ScanPhoto previewUrl={previewUrl} dim="opacity-40" />

      <div role="alert">
        <p className="text-lg font-black tracking-tight">{title}</p>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">{body}</p>
        {message && message !== title ? (
          <p className="mt-2 text-sm font-semibold text-destructive">
            {message}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Receipt photo"
        className="hidden"
        disabled={busy}
        onChange={handleFile}
      />
      <div className="flex w-full flex-col gap-2">
        <Button
          className="min-h-12"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <RiCameraLine aria-hidden />
          {copy.scanAgain}
        </Button>
        <Button
          variant="outline"
          className="min-h-12"
          disabled={busy}
          onClick={onEnterManually}
        >
          {busy ? <RiLoader4Line className="animate-spin" aria-hidden /> : null}
          {busy ? copy.working : copy.enterManually}
        </Button>
      </div>
    </div>
  )
}
