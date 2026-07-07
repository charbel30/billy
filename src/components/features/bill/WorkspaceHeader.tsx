import { RiExchangeDollarLine, RiGroupLine } from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { formatLbp } from '~/lib/currency'
import { statusLabel } from '~/lib/bill/status'
import type { BillStatus } from '~/lib/types'

// Workspace title row: merchant name + status badge on the left, live-link and
// rate pills on the right. Shared by the host split screen and the guest view.
export function WorkspaceHeader({
  merchantName,
  status,
  rate,
  description,
}: {
  merchantName: string
  status: BillStatus
  rate: number | null | undefined
  description: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <RiGroupLine className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
              {merchantName || 'Split it'}
            </h1>
            <Badge variant={status === 'FINALIZED' ? 'secondary' : 'outline'}>
              {statusLabel(status)}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {status === 'PUBLISHED' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500" />
            Link live
          </span>
        ) : null}
        {rate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <RiExchangeDollarLine className="size-4" />
            <span className="tabular-nums">$1 = {formatLbp(rate)}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
