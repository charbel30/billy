import { useState } from 'react'
import { RiUserAddLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { BottomSheet } from '~/components/ui/bottom-sheet'
import { NameEntryForm } from './NameEntryForm'

export function AddPerson({ onAdd, variant, label = 'Add person' }: {
  onAdd: (name: string) => void | Promise<void>
  variant: 'panel' | 'bar'
  label?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        className={variant === 'bar' ? 'min-h-11 shrink-0 rounded-full' : 'min-h-11 w-full'}
        onClick={() => setOpen(true)}
      >
        <RiUserAddLine aria-hidden />{label}
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={(next) => { if (!pending) setOpen(next) }}
        title="Add someone to the table"
        description="Pick their items from this phone."
        responsive
      >
        <NameEntryForm submitLabel="Add person" pendingLabel="Adding…" onCancel={() => setOpen(false)} onSubmit={async (name) => {
          setPending(true)
          try { await onAdd(name); setOpen(false) } finally { setPending(false) }
        }} />
      </BottomSheet>
    </>
  )
}
