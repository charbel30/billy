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
import { SAVE_DELAY_MS } from '~/lib/bill/constants'
import { getHostToken } from '~/lib/session'
import {
  clearWorkingBill,
  persistWorkingBill,
  readWorkingBill,
} from '~/lib/bill/storage'
import type {
  LineItem,
  Person,
} from '~/lib/types'
import type { BillEditor, WorkingBill, WorkingMeta } from '~/lib/bill/types'
import {
  canPersistWorkingBill,
  sanitizeWorkingBill,
  workingBillFromDoc,
} from '~/lib/bill/working'

// Local-first editor (architecture-decision.md). The bill's items/people/meta
// load once from Convex, then React state OWNS them while dirty. Edits are plain
// in-memory array manipulation; we persist with a debounced (~5s) `saveWorking`
// that replaces the working document. We also flush on tab-hide / pagehide /
// unmount, mirror the working state to localStorage, and replay it on reload.
// Concurrent editors are last-write-wins with an "edited elsewhere" hint.
// Claims are NOT edited here — they live in their own table, written by the
// scoped claim mutations; saveWorking reconciles the rows server-side.

export function useBillEditor(
  id: Id<'bills'>,
  { readOnly = false }: { readOnly?: boolean } = {},
): BillEditor {
  const { data: serverDoc } = useSuspenseQuery(billQueries.detail(id))
  const saveWorking = useSaveWorking()

  const [working, setWorking] = useState<WorkingBill>(() =>
    workingBillFromDoc(serverDoc),
  )
  const [editedElsewhere, setEditedElsewhere] = useState(false)

  const workingRef = useRef<WorkingBill>(working)
  const dirtyRef = useRef(false)
  const baseVersionRef = useRef(serverDoc.version)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveWorkingRef = useRef(saveWorking.mutateAsync)

  useEffect(() => {
    saveWorkingRef.current = saveWorking.mutateAsync
  }, [saveWorking.mutateAsync])

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const cur = workingRef.current
    if (!cur) return true
    const clean = sanitizeWorkingBill(cur)
    if (readOnly) return canPersistWorkingBill(clean)
    if (!dirtyRef.current) return canPersistWorkingBill(clean)
    if (!canPersistWorkingBill(clean)) {
      dirtyRef.current = true
      return false
    }

    dirtyRef.current = false
    try {
      await saveWorkingRef.current({
        id,
        hostToken: getHostToken(id),
        lineItems: clean.lineItems,
        people: clean.people,
        meta: clean.meta,
      })
      // Our own write bumps the server version; track it so the returning push
      // isn't mistaken for an external edit.
      baseVersionRef.current += 1
      clearWorkingBill(id)
      return true
    } catch {
      dirtyRef.current = true // leave dirty so a later flush retries
      return false
    }
  }, [id, readOnly])

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }, [flush])

  const commit = useCallback(
    (next: WorkingBill) => {
      if (readOnly) return
      workingRef.current = next
      dirtyRef.current = true
      setWorking(next)
      persistWorkingBill(id, next)
      scheduleFlush()
    },
    [id, readOnly, scheduleFlush],
  )

  const mutate = useCallback(
    (fn: (w: WorkingBill) => WorkingBill) => {
      commit(fn(workingRef.current))
    },
    [commit],
  )

  // Adopt server pushes when we're not mid-edit; otherwise flag a concurrent edit
  // and keep local (last-write-wins on the next flush).
  useEffect(() => {
    if (!dirtyRef.current) {
      const w = workingBillFromDoc(serverDoc)
      workingRef.current = w
      baseVersionRef.current = serverDoc.version
      setWorking(w)
      setEditedElsewhere(false)
    } else if (serverDoc.version > baseVersionRef.current) {
      baseVersionRef.current = serverDoc.version
      setEditedElsewhere(true)
    }
  }, [serverDoc])

  // Replay a locally-saved working copy (e.g. tab was closed mid-edit) when it's
  // at least as new as the server doc.
  useEffect(() => {
    if (readOnly) return
    const local = readWorkingBill(id)
    if (local && local.version >= serverDoc.version) {
      workingRef.current = local
      dirtyRef.current = true
      setWorking(local)
      scheduleFlush()
    }
    // run once on mount for this bill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, readOnly])

  // Flush on tab-hide and pagehide (beforeunload is unreliable on iOS Safari) and
  // when the component unmounts (route change).
  useEffect(() => {
    const onHide = () => void flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      void flush()
    }
  }, [flush])

  // -------------------------------------------------------------------------
  // Editing API
  // -------------------------------------------------------------------------

  const setMeta = useCallback(
    (patch: Partial<WorkingMeta>) =>
      mutate((w) => updateMeta(w, patch)),
    [mutate],
  )

  const addLineItem = useCallback(
    (item?: Partial<LineItem>) =>
      mutate((w) => addLineItemToBill(w, item)),
    [mutate],
  )

  const updateLineItem = useCallback(
    (itemId: string, patch: Partial<LineItem>) =>
      mutate((w) => updateLineItemInBill(w, itemId, patch)),
    [mutate],
  )

  const removeLineItem = useCallback(
    (itemId: string) =>
      mutate((w) => removeLineItemFromBill(w, itemId)),
    [mutate],
  )

  const addPerson = useCallback(
    (name: string) =>
      mutate((w) => addPersonToBill(w, name)),
    [mutate],
  )

  const updatePerson = useCallback(
    (personId: string, patch: Partial<Person>) =>
      mutate((w) => updatePersonInBill(w, personId, patch)),
    [mutate],
  )

  const removePerson = useCallback(
    (personId: string) =>
      mutate((w) => removePersonFromBill(w, personId)),
    [mutate],
  )

  return {
    bill: working,
    status: working.status,
    saving: saveWorking.isPending,
    editedElsewhere,
    extracting: Boolean(serverDoc.imageRef) && serverDoc.lineItems.length === 0,
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
