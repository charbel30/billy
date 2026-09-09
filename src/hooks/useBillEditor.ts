import { useCallback, useEffect, useRef, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import { billQueries, useSaveWorking } from '~/api'
import {
  addLineItemToBill,
  addPersonToBill,
  removeLineItemFromBill,
  removePersonFromBill,
  updateLineItemInBill,
  updateMeta,
  updatePersonInBill,
} from '~/lib/bill/edits'
import { EditorSession } from '~/lib/bill/editorSession'
import { SAVE_DELAY_MS } from '~/lib/bill/constants'
import { getHostToken } from '~/lib/session'
import {
  clearWorkingBill,
  persistWorkingBill,
  readWorkingBill,
} from '~/lib/bill/storage'
import type { LineItem, Person } from '~/lib/types'
import type { BillEditor, WorkingBill, WorkingMeta } from '~/lib/bill/types'
import { canPersistWorkingBill, workingBillFromDoc } from '~/lib/bill/working'

// Local-first editor (architecture-decision.md). The bill's items/people/meta
// load once from Convex, then React state OWNS them while dirty. Edits are plain
// in-memory array manipulation; we persist with a debounced (~5s) `saveWorking`
// that replaces the working document. We also flush on tab-hide / pagehide /
// unmount, mirror the working state to localStorage, and replay it on reload.
// Concurrent editors use version checks and require an explicit conflict decision.
// Claims are NOT edited here — they live in their own table, written by the
// scoped claim mutations; saveWorking reconciles the rows server-side.

export function useBillEditor(
  id: Id<'bills'>,
  { readOnly = false }: { readOnly?: boolean } = {},
): BillEditor {
  const { data: serverDoc } = useSuspenseQuery(billQueries.detail(id))
  const saveWorking = useSaveWorking()

  const saveWorkingRef = useRef(saveWorking.mutateAsync)
  saveWorkingRef.current = saveWorking.mutateAsync
  const [session] = useState(
    () =>
      new EditorSession(workingBillFromDoc(serverDoc), {
        save: (draft, baseVersion) =>
          saveWorkingRef.current({
            id,
            hostToken: getHostToken(id),
            baseVersion,
            lineItems: draft.lineItems,
            people: draft.people,
            meta: draft.meta,
          }),
        persist: (draft) => persistWorkingBill(id, draft),
        clear: (draft) => clearWorkingBill(id, draft),
      }),
  )
  const [, render] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => session.subscribe(() => render((n) => n + 1)), [session])
  useEffect(
    () => session.receive(workingBillFromDoc(serverDoc)),
    [session, serverDoc],
  )

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (readOnly) return canPersistWorkingBill(session.working)
    return session.flush()
  }, [session, readOnly])
  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }, [flush])
  const mutate = useCallback(
    (fn: (w: WorkingBill) => WorkingBill) => {
      if (readOnly) return
      session.edit(fn(session.working))
      scheduleFlush()
    },
    [session, readOnly, scheduleFlush],
  )

  useEffect(() => {
    if (readOnly) return
    const local = readWorkingBill(id)
    if (local) {
      session.restore(local)
      scheduleFlush()
    }
  }, [id, readOnly, session, scheduleFlush])

  useEffect(() => {
    const onHide = () => {
      void flush()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onOnline = () => {
      void flush()
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      void flush()
    }
  }, [flush])

  // -------------------------------------------------------------------------
  // Editing API
  // -------------------------------------------------------------------------

  const setMeta = useCallback(
    (patch: Partial<WorkingMeta>) => mutate((w) => updateMeta(w, patch)),
    [mutate],
  )

  const addLineItem = useCallback(
    (item?: Partial<LineItem>) => mutate((w) => addLineItemToBill(w, item)),
    [mutate],
  )

  const updateLineItem = useCallback(
    (itemId: string, patch: Partial<LineItem>) =>
      mutate((w) => updateLineItemInBill(w, itemId, patch)),
    [mutate],
  )

  const removeLineItem = useCallback(
    (itemId: string) => mutate((w) => removeLineItemFromBill(w, itemId)),
    [mutate],
  )

  const addPerson = useCallback(
    (name: string) => mutate((w) => addPersonToBill(w, name)),
    [mutate],
  )

  const updatePerson = useCallback(
    (personId: string, patch: Partial<Person>) =>
      mutate((w) => updatePersonInBill(w, personId, patch)),
    [mutate],
  )

  const removePerson = useCallback(
    (personId: string) => mutate((w) => removePersonFromBill(w, personId)),
    [mutate],
  )

  return {
    bill: session.working,
    status: session.working.status,
    saving: session.state === 'saving',
    saveState: session.state,
    editedElsewhere: session.editedElsewhere,
    recoveryUnavailable: session.recoveryUnavailable,
    useServerVersion: () => session.useServer(),
    keepLocalVersion: () => {
      session.keepLocal()
      void flush()
    },
    extracting: Boolean(serverDoc.imageRef),
    setMeta,
    addLineItem,
    updateLineItem,
    removeLineItem,
    addPerson,
    updatePerson,
    removePerson,
    flushNow: flush,
  }
}
