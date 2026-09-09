import type { ReactNode } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { Loader } from './Loader'

export function HostAccessBoundary({
  billId,
  children,
}: {
  billId: string
  children: ReactNode
}) {
  return (
    <ClientOnly fallback={<Loader />}>
      <HostAccess billId={billId}>{children}</HostAccess>
    </ClientOnly>
  )
}

function HostAccess({
  billId,
  children,
}: {
  billId: string
  children: ReactNode
}) {
  const hasAccess = useHasHostToken(billId)
  if (hasAccess) return children
  return (
    <div className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-bold">
        Open this bill on the original browser
      </h1>
      <p className="text-muted-foreground">
        Host access stays in the browser that created the bill. A bookmark does
        not restore access after site data is cleared. To view someone else’s
        bill, ask the host for an invitation link.
      </p>
    </div>
  )
}
