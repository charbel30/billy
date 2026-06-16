import { useCallback, useEffect, useRef, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import { billQueries, useSaveWorking } from '~/queries'
import {
  addLineItemToBill,
  addPersonToBill,
  removeLineItemFromBill,
  removePersonFromBill,
  setClaimOnBill,
  shareItemEvenly,
  stepClaimOnBill,
  updateLineItemInBill,
  updateMeta,
  updatePersonInBill,
} from '~/lib/bill/edits'
import { SAVE_DELAY_MS } from '~/lib/bill/constants'
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

// Local-first editor (architecture-decision.md). The whole bill loads once from
// Convex, then React state OWNS it while dirty. Edits are plain in-memory array
// manipulation; we persist with a debounced (~5s) `saveWorking` that replaces the
// whole working document. We also flush on tab-hide / pagehide / unmount, mirror
// the working state to localStorage, and replay it on reload. Concurrent editors
// are last-write-wins with an "edited elsewhere" hint (single JSON doc; live
// multi-writer claim is a Phase-2 concern).

export function useBillEditor(id: Id<'bills'>): BillEditor {
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
    if (!dirtyRef.current) return canPersistWorkingBill(clean)
    if (!canPersistWorkingBill(clean)) {
      dirtyRef.current = true
      return false
    }

    dirtyRef.current = false
    try {
      await saveWorkingRef.current({
        id,
        lineItems: clean.lineItems,
        people: clean.people,
        claims: clean.claims,
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
  }, [id])

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }, [flush])

  const commit = useCallback(
    (next: WorkingBill) => {
      workingRef.current = next
      dirtyRef.current = true
      setWorking(next)
      persistWorkingBill(id, next)
      scheduleFlush()
    },
    [id, scheduleFlush],
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
    const local = readWorkingBill(id)
    if (local && local.version >= serverDoc.version) {
      workingRef.current = local
      dirtyRef.current = true
      setWorking(local)
      scheduleFlush()
    }
    // run once on mount for this bill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  /** Set the absolute claimed units for (item, person); 0 removes the claim.
   *  Clamps so one person can't claim more than the item's qty. */
  const setClaim = useCallback(
    (itemId: string, personId: string, units: number) =>
      mutate((w) => setClaimOnBill(w, itemId, personId, units)),
    [mutate],
  )

  const stepClaim = useCallback(
    (itemId: string, personId: string, delta: number) =>
      mutate((w) => stepClaimOnBill(w, itemId, personId, delta)),
    [mutate],
  )

  /** Split an item's units evenly among the given people (fractional units). */
  const shareEvenly = useCallback(
    (itemId: string, personIds: string[]) =>
      mutate((w) => shareItemEvenly(w, itemId, personIds)),
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
    setClaim,
    stepClaim,
    shareEvenly,
    flushNow: flush,
  }
}
