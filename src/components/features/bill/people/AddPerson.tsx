import { useState } from 'react'
import { RiUserAddLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog'
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
    <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
      <DialogTrigger render={<Button variant="outline" className={variant === 'bar' ? 'min-h-11 shrink-0 rounded-full' : 'min-h-11 w-full'} />}>
        <RiUserAddLine aria-hidden />{label}
      </DialogTrigger>
      <DialogContent showCloseButton={!pending} className="max-sm:top-auto max-sm:bottom-0 max-sm:start-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>Add someone to the table</DialogTitle>
          <DialogDescription>Pick their items from this phone.</DialogDescription>
        </DialogHeader>
        <NameEntryForm submitLabel="Add person" pendingLabel="Adding…" onCancel={() => setOpen(false)} onSubmit={async (name) => {
          setPending(true)
          try { await onAdd(name); setOpen(false) } finally { setPending(false) }
        }} />
      </DialogContent>
    </Dialog>
  )
}
