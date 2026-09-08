import { cn } from '~/lib/utils'

/** Decorative motion only; the caller owns the live status and real progress. */
export function ReceiptScan({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 88"
      fill="none"
      aria-hidden="true"
      className={cn('receipt-scan size-16 shrink-0', className)}
    >
      <path
        d="M19 10l7 4 7-4 7 4 7-4 7 4 7-4v68l-7-4-7 4-7-4-7 4-7-4-7 4V10Z"
        fill="var(--card)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28 28h24M28 38h17M28 48h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".3" />
      <path d="M28 63h10m7 0h7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g className="receipt-scan-beam">
        <rect x="10" y="19" width="60" height="12" rx="6" fill="var(--primary)" opacity=".25" />
        <path d="M12 25h56" stroke="var(--primary-strong)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
