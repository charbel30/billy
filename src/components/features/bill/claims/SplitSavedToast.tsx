import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/components/ui/button'

export function SplitSavedToast({ itemName, undo, toastId }: { itemName: string; undo: () => Promise<void>; toastId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 text-sm">{error ? 'Could not undo. Check the current claims on this item.' : `Split saved for ${itemName}`}</span>
      {!error ? (
        <Button variant="ghost" size="lg" disabled={pending} onClick={async () => {
          setPending(true)
          try {
            await undo()
            toast.dismiss(toastId)
          } catch {
            setError(true)
          } finally {
            setPending(false)
          }
        }}>{pending ? 'Undoing…' : 'Undo'}</Button>
      ) : null}
    </div>
  )
}
