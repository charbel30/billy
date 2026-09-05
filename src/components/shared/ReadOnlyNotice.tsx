import { Link } from '@tanstack/react-router'
import { RiArrowRightLine, RiLockLine } from '@remixicon/react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'

export function ReadOnlyNotice({
  shareToken,
  finalized = false,
}: {
  shareToken?: string | null
  finalized?: boolean
}) {
  return (
    <Alert variant="info" className="shadow-sm">
      <RiLockLine />
      <AlertTitle className="font-bold text-balance">
        View only on this device
      </AlertTitle>
      <AlertDescription>
        {finalized
          ? 'This device does not have edit access for this bill. The finalized receipt is safe to view here.'
          : 'This device does not have edit access for this bill. Reopen it on the device that created the bill to make changes.'}
      </AlertDescription>
      {shareToken ? (
        <div className="col-start-2 mt-2">
          <Link
            to="/join/$shareToken"
            params={{ shareToken }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-info-subtle-foreground underline underline-offset-4 transition-[scale,opacity] hover:opacity-80 active:scale-[0.96]"
          >
            Open guest view
            <RiArrowRightLine className="size-4" />
          </Link>
        </div>
      ) : null}
    </Alert>
  )
}
