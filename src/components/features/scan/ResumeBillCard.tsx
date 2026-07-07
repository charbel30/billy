import { RiArrowRightLine, RiRestartLine } from '@remixicon/react'
import type { BillHistoryEntry } from '~/lib/billHistory'
import { STEP_LABEL } from './content'

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
      className="group flex items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 text-left shadow-card transition-[scale,border-color,box-shadow] hover:border-foreground/15 hover:shadow-card-hover active:scale-[0.96]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-strong">
          <RiRestartLine className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">
            Resume {entry.name?.trim() || 'your bill'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Pick up where you left off · {STEP_LABEL[entry.step]}
          </span>
        </span>
      </span>
      <RiArrowRightLine className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
