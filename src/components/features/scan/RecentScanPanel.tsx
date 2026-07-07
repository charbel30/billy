import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiArrowRightLine, RiFileList3Line, RiReceiptLine } from '@remixicon/react'
import type { BillHistoryEntry } from '~/lib/billHistory'
import { timeAgo } from '~/lib/format'
import { EmptyState } from '~/components/shared/EmptyState'
import { COLLAPSED_COUNT, STEP_LABEL, scanHubCopy } from './content'

export function RecentScanPanel({
  entries,
  onOpen,
  onClear,
}: {
  entries: BillHistoryEntry[]
  onOpen: (entry: BillHistoryEntry) => void
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = entries.length > COLLAPSED_COUNT
  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT)

  return (
    <section className="rounded-card bg-card/80 p-4 shadow-card ring-1 ring-border/50 backdrop-blur md:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{scanHubCopy.recentTitle}</h2>
        <div className="flex items-center gap-2">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
            >
              Clear
            </button>
          ) : null}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
            {entries.length}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={RiReceiptLine}
          title={scanHubCopy.emptyRecent}
          hint={scanHubCopy.emptyRecentHint}
        />
      ) : (
        <>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {visible.map((entry) => (
                <motion.button
                  key={entry.billId}
                  layout
                  type="button"
                  onClick={() => onOpen(entry)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex w-full items-center gap-3 rounded-control bg-muted/60 px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-strong">
                    <RiFileList3Line className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {entry.name?.trim() || 'Untitled bill'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {STEP_LABEL[entry.step]} · {timeAgo(entry.at)}
                    </span>
                  </span>
                  <RiArrowRightLine className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-full py-2 text-xs font-bold text-primary-strong transition-colors hover:bg-primary/10"
            >
              {expanded ? 'Show less' : `Show all ${entries.length}`}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}
