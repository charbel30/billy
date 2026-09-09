import type { SaveState } from '~/lib/bill/editorSession'

export function SaveStatus({
  state,
  onRetry,
}: {
  state: SaveState
  onRetry: () => void
}) {
  if (state === 'saved') return null
  return (
    <span role="status" className="text-xs font-medium text-muted-foreground">
      {state === 'unsaved'
        ? 'Unsaved changes'
        : state === 'saving'
          ? 'Saving…'
          : 'Changes not saved. '}
      {state === 'failed' ? (
        <button type="button" className="underline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </span>
  )
}
