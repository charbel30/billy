import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: Privacy,
})

// Plain-language policy (spec §10): be explicit that the receipt photo is
// processed in the cloud and deleted, and keep collection minimal. Every claim
// here is checked against the code — if the pipeline changes, this page changes.
function Privacy() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight">Privacy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated: September 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-base font-bold">The short version</h2>
          <p>
            Spolio reads a photo of your receipt, turns it into a list of items,
            and helps your group split it. There are no accounts and no
            passwords. Your photo is sent to Google&apos;s Gemini model to be
            read, then deleted. What I keep is the text that came off the
            receipt, not the picture.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">The receipt photo</h2>
          <p>
            When you take a photo, your browser shrinks it and uploads it to the
            backend. A job then sends it to Google Gemini through Cloudflare AI
            Gateway, which reads out the items and prices. The image is deleted
            from storage as soon as that finishes — and also if the reading
            fails after its retries, so either way the photo doesn&apos;t stick
            around. One caveat worth stating rather than hiding: the AI gateway
            is configured to cache a scan for up to 24 hours, so a copy can sit
            there briefly before it expires.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">What I keep</h2>
          <p>
            The bill itself: what the receipt printed (merchant, items,
            quantities, prices, totals) and what your group adds (the names
            people type in, and who claimed what). No email, no phone number, no
            location, no image. A bill is deleted automatically 60 days after
            the last change to it; that cleanup runs daily.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Share links</h2>
          <p>
            Publishing a bill creates a link with a random token in it. Anyone
            holding that link can open the bill, see every person&apos;s total,
            and claim items — there is no password on it, the link{' '}
            <em>is</em> the key. So use first names or nicknames, and send it
            only to the people at your table. You can revoke a link while the
            split is open, which issues a new one and kills the old immediately;
            after you finalize a bill it can no longer be revoked.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">What your browser stores</h2>
          <p>
            All of it is localStorage, no cookies: a random device id used only
            for rate limiting, a list of your recent bills, the keys that let
            this device edit bills you created, whether you prefer LBP or USD,
            your light/dark choice, and a random id for each bill you join as a
            guest. Clearing site data clears all of it — including those edit
            keys, which can&apos;t be recovered.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">No tracking, no payments</h2>
          <p>
            There is no analytics, no advertising and no third-party tracking
            script on this site, and no profile of you anywhere. Spolio never
            touches money: no card numbers, no bank details, no payments ever.
            If analytics is ever added, this page changes first.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Who runs this, and deletions</h2>
          <p>
            Spolio is run by one person in Lebanon — there is no company behind
            it. Want a bill removed before the 60 days are up? Email{' '}
            <strong>support@spolio.net</strong> with the share link and
            I&apos;ll delete it.
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
