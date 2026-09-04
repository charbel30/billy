import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: Terms,
})

function Terms() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight">Terms of use</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated: September 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-base font-bold">What Spolio is</h2>
          <p>
            Spolio is a bill-splitting calculator for Lebanon. It reads a
            receipt photo, shows amounts in both LBP and USD (at your
            receipt&apos;s own rate when it prints both), and works out what
            each person owes. It does not hold, move or process money —
            settling up happens between you and your friends, outside the app.
            It is free, and it is run by one person in Lebanon, not a company.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Check the numbers yourself</h2>
          <p>
            Receipt reading is automatic, and automatic sometimes means wrong.
            Spolio checks its own arithmetic against the printed total, flags
            items it isn&apos;t confident about, and always shows you a review
            screen before the split — but the amounts you settle on are yours to
            verify. The paper receipt is the source of truth, not this app.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Share links</h2>
          <p>
            Publishing a bill gives you a link. Anyone holding it can open the
            bill and claim items; there is no password, so treat it like a house
            key and send it only to your group. You can revoke a link while the
            split is open — that replaces it with a new one and the old link
            stops working at once. Once you finalize a bill, its link can no
            longer be revoked.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Your bills live in this browser</h2>
          <p>
            There are no accounts. The ability to edit a bill you created is
            held in this browser, not on a server tied to you. If you clear your
            site data, switch phones, or scan in a private window, you lose the
            ability to edit those bills — there is no login to fall back on and
            no way for me to restore access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Fair use</h2>
          <p>
            Please don&apos;t script the scanner, scrape the app, or go looking
            for bills that aren&apos;t yours. Every scan costs real money, so
            scanning is rate-limited per device and capped in total per day; if
            the daily cap is reached, scanning pauses for everyone until it
            resets. Abuse just means tighter limits for everybody.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">No warranty</h2>
          <p>
            Spolio is provided as-is, free of charge, with no guarantees: it may
            be unavailable, lose data, or misread a receipt. Bills are deleted
            automatically after 60 days of inactivity (see the{' '}
            <Link to="/privacy" className="font-semibold text-primary hover:underline">
              privacy page
            </Link>
            ), so don&apos;t rely on it as a record of anything you&apos;ll need
            later. Use it at your own risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Changes and contact</h2>
          <p>
            These terms will change as the app does; the date at the top says
            when they last did. Questions, complaints or bug reports:{' '}
            <strong>support@spolio.net</strong>
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm">
        <Link to="/" className="font-semibold text-primary hover:underline">
          ← Back to Spolio
        </Link>
      </p>
    </div>
  )
}
