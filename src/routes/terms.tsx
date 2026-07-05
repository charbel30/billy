import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: Terms,
})

function Terms() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight">Terms of use</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated: July 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-base font-bold">What Billy is</h2>
          <p>
            Billy is a bill-splitting calculator. It reads receipts, shows
            amounts in LBP and USD, and computes per-person totals. It does not
            hold, transfer, or process money — settling up happens between you
            and your friends, outside the app.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Check your bill</h2>
          <p>
            Receipt reading is automatic and can make mistakes. Billy checks
            the math against the printed total and flags anything doubtful,
            and always shows you a review screen — but the amounts you settle
            on are your responsibility. The paper receipt stays the source of
            truth.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Share links</h2>
          <p>
            A bill&apos;s share link lets anyone who has it view the bill and
            claim items. Share it only with your group. Hosts can revoke a
            link at any time; revoked links stop working immediately.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Fair use</h2>
          <p>
            Don&apos;t abuse the service: no automated scanning, no scraping,
            no attempts to access bills that aren&apos;t yours. We rate-limit
            scanning to keep the service free and available for everyone.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">No warranty</h2>
          <p>
            Billy is provided as-is, free of charge, without warranties of any
            kind. Bills are automatically deleted after a period of inactivity
            (see the <Link to="/privacy" className="font-semibold text-primary hover:underline">privacy page</Link>),
            so don&apos;t rely on Billy as a permanent record.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Contact</h2>
          <p>
            Questions about these terms: <strong>billy.leb@gmail.com</strong>
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm">
        <Link to="/" className="font-semibold text-primary hover:underline">
          ← Back to Billy
        </Link>
      </p>
    </div>
  )
}
