import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: Privacy,
})

// Plain-language policy (spec §10): be explicit that the receipt photo is
// processed in the cloud and deleted, and keep collection minimal.
function Privacy() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-black tracking-tight">Privacy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated: July 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-base font-bold">The short version</h2>
          <p>
            Billy reads a photo of your receipt, turns it into a list of items,
            and helps your group split it. We keep as little as possible: no
            accounts, no passwords, no card numbers — and the receipt photo is
            deleted right after it is read.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">The receipt photo</h2>
          <p>
            When you scan a receipt, the photo leaves your device: it is sent
            to our backend and processed by a cloud AI service (Google Gemini,
            routed through Cloudflare AI Gateway) that extracts the line items.
            The photo is deleted from our storage immediately after extraction
            — we keep the extracted text (item names, quantities, prices), not
            the image.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">What we store</h2>
          <p>
            A bill holds what the receipt printed (merchant, items, totals) and
            what your group enters (people&apos;s display names and who claimed
            what). Anyone who has the bill&apos;s share link can see this, so
            use first names or nicknames. Bills that go untouched are deleted
            automatically after about 60 days. Your device keeps a local list
            of your own recent bills; clearing your browser storage clears it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">What we never collect</h2>
          <p>
            No payment card data, no contacts, no location. Billy is a
            calculator: it never moves money.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Legal basis</h2>
          <p>
            Billy is operated from Lebanon and handles personal data in line
            with Lebanese Law No. 81/2018 (Electronic Transactions and Personal
            Data). We collect the minimum needed to provide the service and do
            not sell or share your data with third parties beyond the
            processing described above.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Questions or deletion requests</h2>
          <p>
            Want a bill removed sooner than the automatic cleanup? Contact us
            and include the share link: <strong>billy.leb@gmail.com</strong>
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
