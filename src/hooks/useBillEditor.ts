import { useCallback, useEffect, useRef, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Doc, Id } from 'convex/_generated/dataModel'
import { billQueries, useSaveWorking } from '~/queries'
import type {
  BillStatus,
  Claim,
  LineItem,
  Person,
  RateSource,
  ServiceSplitMode,
} from '~/lib/types'

// Local-first editor (architecture-decision.md). The whole bill loads once from
// Convex, then React state OWNS it while dirty. Edits are plain in-memory array
// manipulation; we persist with a debounced (~5s) `saveWorking` that replaces the
// whole working document. We also flush on tab-hide / pagehide / unmount, mirror
// the working state to localStorage, and replay it on reload. Concurrent editors
// are last-write-wins with an "edited elsewhere" hint (single JSON doc; live
// multi-writer claim is a Phase-2 concern).

const SAVE_DELAY = 5000

export interface WorkingMeta {
  merchantName: string
  branch?: string
  datetime?: string
  currencyPrimary: string
  rate?: number
  rateSource: RateSource
  serviceCharge: number
  tax: number
  serviceChargeOn: boolean
  serviceSplitMode: ServiceSplitMode
  printedTotalLbp?: number
  printedTotalUsd?: number
}

export interface WorkingBill {
  lineItems: LineItem[]
  people: Person[]
  claims: Claim[]
  meta: WorkingMeta
  version: number
  status: BillStatus
}

const PERSON_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

function newId(): string {
  return crypto.randomUUID()
}

function fromDoc(d: Doc<'bills'>): WorkingBill {
  return {
    lineItems: d.lineItems,
    people: d.people,
    claims: d.claims,
    version: d.version,
    status: d.status,
    meta: {
      merchantName: d.merchantName,
      branch: d.branch,
      datetime: d.datetime,
      currencyPrimary: d.currencyPrimary,
      rate: d.rate,
      rateSource: d.rateSource,
      serviceCharge: d.serviceCharge,
      tax: d.tax,
      serviceChargeOn: d.serviceChargeOn,
      serviceSplitMode: d.serviceSplitMode,
      printedTotalLbp: d.printedTotalLbp,
      printedTotalUsd: d.printedTotalUsd,
    },
  }
}

const lsKey = (id: Id<'bills'>) => `bill-working:${id}`

function persistLocal(id: Id<'bills'>, w: WorkingBill) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(lsKey(id), JSON.stringify(w))
  } catch {
    // storage full / disabled — the server flush is still the source of truth.
  }
}

function clearLocal(id: Id<'bills'>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(lsKey(id))
  } catch {
    /* ignore */
  }
}

/** Strip each array element to exactly its schema fields. Guards against stale
 *  localStorage or older-shaped objects (e.g. with `_id`/`billId`) ever reaching
 *  saveWorking, whose validators are strict about both extra and missing fields. */
function sanitize(w: WorkingBill): WorkingBill {
  return {
    ...w,
    lineItems: w.lineItems.map((li) => ({
      id: li.id,
      name: li.name,
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
      ...(li.confidence != null ? { confidence: li.confidence } : {}),
    })),
    people: w.people.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    claims: w.claims.map((c) => ({
      itemId: c.itemId,
      personId: c.personId,
      units: c.units,
    })),
  }
}

/** A stored working copy is only usable if it's the new single-doc shape: a
 *  numeric version and arrays whose ids are strings. Anything else is stale. */
function isValidWorking(w: unknown): w is WorkingBill {
  if (!w || typeof w !== 'object') return false
  const o = w as Record<string, unknown>
  if (typeof o.version !== 'number') return false
  if (!Array.isArray(o.lineItems) || !Array.isArray(o.people) || !Array.isArray(o.claims))
    return false
  return (
    o.lineItems.every((li) => li && typeof (li as { id?: unknown }).id === 'string') &&
    o.people.every((p) => p && typeof (p as { id?: unknown }).id === 'string')
  )
}

function readLocal(id: Id<'bills'>): WorkingBill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(lsKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isValidWorking(parsed)) {
      window.localStorage.removeItem(lsKey(id)) // purge stale/old-shaped state
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export interface BillEditor {
  bill: WorkingBill
  status: BillStatus
  saving: boolean
  editedElsewhere: boolean
  /** True while the vision model is still reading an attached image. */
  extracting: boolean
  // meta
  setMeta: (patch: Partial<WorkingMeta>) => void
  // line items
  addLineItem: (item?: Partial<LineItem>) => void
  updateLineItem: (id: string, patch: Partial<LineItem>) => void
  removeLineItem: (id: string) => void
  // people
  addPerson: (name: string) => void
  updatePerson: (id: string, patch: Partial<Person>) => void
  removePerson: (id: string) => void
  // claims (unit-by-unit)
  setClaim: (itemId: string, personId: string, units: number) => void
  stepClaim: (itemId: string, personId: string, delta: number) => void
  shareEvenly: (itemId: string, personIds: string[]) => void
  // persistence
  flushNow: () => Promise<void>
}

export function useBillEditor(id: Id<'bills'>): BillEditor {
  const { data: serverDoc } = useSuspenseQuery(billQueries.detail(id))
  const saveWorking = useSaveWorking()

  const [working, setWorking] = useState<WorkingBill>(() => fromDoc(serverDoc))
  const [editedElsewhere, setEditedElsewhere] = useState(false)

  const workingRef = useRef<WorkingBill>(working)
  const dirtyRef = useRef(false)
  const baseVersionRef = useRef(serverDoc.version)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const cur = workingRef.current
    if (!cur || !dirtyRef.current) return
    dirtyRef.current = false
    const clean = sanitize(cur)
    try {
      await saveWorking.mutateAsync({
        id,
        lineItems: clean.lineItems,
        people: clean.people,
        claims: clean.claims,
        meta: clean.meta,
      })
      // Our own write bumps the server version; track it so the returning push
      // isn't mistaken for an external edit.
      baseVersionRef.current += 1
      clearLocal(id)
    } catch {
      dirtyRef.current = true // leave dirty so a later flush retries
    }
  }, [id, saveWorking])

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY)
  }, [flush])

  const commit = useCallback(
    (next: WorkingBill) => {
      workingRef.current = next
      dirtyRef.current = true
      setWorking(next)
      persistLocal(id, next)
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
      const w = fromDoc(serverDoc)
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
    const local = readLocal(id)
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
      mutate((w) => ({ ...w, meta: { ...w.meta, ...patch } })),
    [mutate],
  )

  const addLineItem = useCallback(
    (item?: Partial<LineItem>) =>
      mutate((w) => ({
        ...w,
        lineItems: [
          ...w.lineItems,
          {
            id: newId(),
            name: item?.name ?? '',
            qty: item?.qty ?? 1,
            unitPrice: item?.unitPrice ?? 0,
            lineTotal: item?.lineTotal ?? (item?.qty ?? 1) * (item?.unitPrice ?? 0),
            confidence: item?.confidence,
          },
        ],
      })),
    [mutate],
  )

  const updateLineItem = useCallback(
    (itemId: string, patch: Partial<LineItem>) =>
      mutate((w) => ({
        ...w,
        lineItems: w.lineItems.map((li) =>
          li.id === itemId ? { ...li, ...patch } : li,
        ),
      })),
    [mutate],
  )

  const removeLineItem = useCallback(
    (itemId: string) =>
      mutate((w) => ({
        ...w,
        lineItems: w.lineItems.filter((li) => li.id !== itemId),
        claims: w.claims.filter((c) => c.itemId !== itemId),
      })),
    [mutate],
  )

  const addPerson = useCallback(
    (name: string) =>
      mutate((w) => ({
        ...w,
        people: [
          ...w.people,
          {
            id: newId(),
            name,
            color: PERSON_COLORS[w.people.length % PERSON_COLORS.length],
          },
        ],
      })),
    [mutate],
  )

  const updatePerson = useCallback(
    (personId: string, patch: Partial<Person>) =>
      mutate((w) => ({
        ...w,
        people: w.people.map((p) =>
          p.id === personId ? { ...p, ...patch } : p,
        ),
      })),
    [mutate],
  )

  const removePerson = useCallback(
    (personId: string) =>
      mutate((w) => ({
        ...w,
        people: w.people.filter((p) => p.id !== personId),
        claims: w.claims.filter((c) => c.personId !== personId),
      })),
    [mutate],
  )

  /** Set the absolute claimed units for (item, person); 0 removes the claim.
   *  Clamps so one person can't claim more than the item's qty. */
  const setClaim = useCallback(
    (itemId: string, personId: string, units: number) =>
      mutate((w) => {
        const item = w.lineItems.find((li) => li.id === itemId)
        const max = item ? item.qty : units
        const u = Math.max(0, Math.min(units, max))
        const rest = w.claims.filter(
          (c) => !(c.itemId === itemId && c.personId === personId),
        )
        return {
          ...w,
          claims: u > 0 ? [...rest, { itemId, personId, units: u }] : rest,
        }
      }),
    [mutate],
  )

  const stepClaim = useCallback(
    (itemId: string, personId: string, delta: number) =>
      mutate((w) => {
        const item = w.lineItems.find((li) => li.id === itemId)
        const current = w.claims.find(
          (c) => c.itemId === itemId && c.personId === personId,
        )
        const max = item ? item.qty : Infinity
        const u = Math.max(0, Math.min((current?.units ?? 0) + delta, max))
        const rest = w.claims.filter(
          (c) => !(c.itemId === itemId && c.personId === personId),
        )
        return {
          ...w,
          claims: u > 0 ? [...rest, { itemId, personId, units: u }] : rest,
        }
      }),
    [mutate],
  )

  /** Split an item's units evenly among the given people (fractional units). */
  const shareEvenly = useCallback(
    (itemId: string, personIds: string[]) =>
      mutate((w) => {
        const item = w.lineItems.find((li) => li.id === itemId)
        if (!item || personIds.length === 0) return w
        const units = item.qty / personIds.length
        const rest = w.claims.filter((c) => c.itemId !== itemId)
        return {
          ...w,
          claims: [
            ...rest,
            ...personIds.map((personId) => ({ itemId, personId, units })),
          ],
        }
      }),
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
