import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { ShareSplitCard } from './ShareSplitCard'

// One dialog for the QR/share surface, used by both the split and the summary
// screens so the invite flow is identical wherever it is opened from.
export function ShareSplitDialog({
  open,
  onOpenChange,
  title,
  url,
  merchantName,
  onRevoke,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string
  merchantName: string
  onRevoke?: () => Promise<void> | void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ShareSplitCard
          url={url}
          merchantName={merchantName}
          onRevoke={onRevoke}
        />
      </DialogContent>
    </Dialog>
  )
}
