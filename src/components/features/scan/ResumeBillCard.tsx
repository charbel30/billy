import { RiArrowRightLine, RiRestartLine } from '@remixicon/react'
import type { BillHistoryEntry } from '~/lib/billHistory'

// "Pick up where you left off" card for the most recent bill.
export function ResumeBillCard({
  entry,
  onOpen,
}: {
  entry: BillHistoryEntry
  onOpen: (entry: BillHistoryEntry) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group flex items-center justify-between gap-3 rounded-3xl border border-border bg-card px-4 py-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.05)] transition-[transform,border-color] hover:border-foreground/20 active:scale-[0.99]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <RiRestartLine className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">
            Resume {entry.name?.trim() || 'your bill'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Pick up where you left off · {entry.step}
          </span>
        </span>
      </span>
      <RiArrowRightLine className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
