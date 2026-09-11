import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RiArrowRightLine, RiFileList3Line } from '@remixicon/react'
import { softExit } from '~/lib/ui'
import type { BillHistoryEntry } from '~/lib/session'
import { timeAgo } from '~/lib/format'
import { COLLAPSED_COUNT, STEP_LABEL, scanHubCopy } from '../content'

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
    <section className="landing-continue landing-enter" aria-label={scanHubCopy.recentTitle}>
      <div className="landing-continue-head">
        <h2>{scanHubCopy.recentTitle}</h2>
        <button type="button" onClick={onClear}>
          {scanHubCopy.clearRecent}
        </button>
      </div>

      <div className="landing-continue-list">
        <AnimatePresence initial={false}>
          {visible.map((entry) => (
            <motion.button
              key={entry.billId}
              layout
              type="button"
              onClick={() => onOpen(entry)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={softExit}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              whileTap={{ scale: 0.96 }}
              className="landing-continue-row"
            >
              <span className="landing-continue-icon" aria-hidden="true">
                <RiFileList3Line />
              </span>
              <span className="landing-continue-copy">
                <span className="landing-continue-name">
                  {entry.name?.trim() || 'Untitled bill'}
                </span>
                <span className="landing-continue-meta">
                  {STEP_LABEL[entry.step]} · {timeAgo(entry.at)}
                </span>
              </span>
              <RiArrowRightLine aria-hidden="true" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {hasMore ? (
        <button
          type="button"
          className="landing-continue-more"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? scanHubCopy.showLess : `Show all ${entries.length}`}
        </button>
      ) : null}
    </section>
  )
}
