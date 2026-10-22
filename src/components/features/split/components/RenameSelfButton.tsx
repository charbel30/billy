import { useState } from 'react'
import { RiPencilLine } from '@remixicon/react'
import { BottomSheet } from '~/components/ui/bottom-sheet'
import { NameEntryForm } from '~/components/features/bill'
import { DEFAULT_PERSON_NAME } from '~/lib/bill'
import { splitCopy } from '../content'

/** Host-only: a pencil beside the host's own person that opens a name sheet. */
export function RenameSelfButton({ name, onRename }: {
  /** The stored name (still the 'self' seed until the host names themselves). */
  name: string
  onRename: (name: string) => Promise<unknown>
}) {
  const copy = splitCopy.renameSelf
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={copy.button}
        title={copy.button}
        onClick={() => setOpen(true)}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-[color,background-color,scale] hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
      >
        <RiPencilLine className="size-4" aria-hidden />
      </button>
      <BottomSheet
        open={open}
        onOpenChange={(next) => { if (!pending) setOpen(next) }}
        title={copy.title}
        description={copy.description}
        responsive
      >
        {/* Remounts per opening, so the field starts from the current name. */}
        {open ? (
          <NameEntryForm
            initialName={name === DEFAULT_PERSON_NAME ? '' : name}
            copy={copy}
            submitLabel={copy.submit}
            pendingLabel={copy.pending}
            onCancel={() => setOpen(false)}
            onSubmit={async (next) => {
              setPending(true)
              try { await onRename(next); setOpen(false) } finally { setPending(false) }
            }}
          />
        ) : null}
      </BottomSheet>
    </>
  )
}
