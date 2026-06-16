import { useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import type { OptimisticLocalStore } from 'convex/browser'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

// Read option factories (live over WebSocket via the Convex adapter).
export const billQueries = {
  detail: (id: Id<'bills'>) => convexQuery(api.bills.getBill, { id }),
  byToken: (shareToken: string) =>
    convexQuery(api.bills.getBillByToken, { shareToken }),
}

const tempId = () => `temp_${Math.random().toString(36).slice(2)}` as Id<any>

// ---------------------------------------------------------------------------
// Bill lifecycle
// ---------------------------------------------------------------------------

export function useCreateBill() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.createBill) })
}

export function useUpdateBillMeta() {
  const mutationFn = useConvexMutation(api.bills.updateBillMeta).withOptimisticUpdate(
    (localStore, args) => {
      const snap = localStore.getQuery(api.bills.getBill, { id: args.id })
      if (!snap) return
      const { id, ...patch } = args
      const defined = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      )
      localStore.setQuery(
        api.bills.getBill,
        { id: args.id },
        { ...snap, bill: { ...snap.bill, ...defined } },
      )
    },
  )
  return useMutation({ mutationFn })
}

export function useFinalizeShare() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.finalizeShare) })
}

export function useDeleteBill() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.deleteBill) })
}

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

export function useAddLineItem() {
  const mutationFn = useConvexMutation(api.bills.addLineItem).withOptimisticUpdate(
    (localStore, args) => {
      const snap = localStore.getQuery(api.bills.getBill, { id: args.billId })
      if (!snap) return
      const lineItem = {
        _id: tempId() as Id<'lineItems'>,
        _creationTime: Date.now(),
        billId: args.billId,
        name: args.name,
        qty: args.qty,
        unitPrice: args.unitPrice,
        lineTotal: args.lineTotal ?? args.qty * args.unitPrice,
        currency: args.currency ?? snap.bill.currencyPrimary,
        confidence: args.confidence,
      }
      localStore.setQuery(
        api.bills.getBill,
        { id: args.billId },
        { ...snap, lineItems: [...snap.lineItems, lineItem] },
      )
    },
  )
  return useMutation({ mutationFn })
}

export function useUpdateLineItem() {
  const mutationFn = useConvexMutation(api.bills.updateLineItem).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...patch } = args
      const defined = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      )
      // We don't know billId from args; find the snapshot holding this item.
      for (const billId of activeBillIds(localStore)) {
        const snap = localStore.getQuery(api.bills.getBill, { id: billId })
        if (!snap || !snap.lineItems.some((li) => li._id === id)) continue
        localStore.setQuery(
          api.bills.getBill,
          { id: billId },
          {
            ...snap,
            lineItems: snap.lineItems.map((li) =>
              li._id === id ? { ...li, ...defined } : li,
            ),
          },
        )
        return
      }
    },
  )
  return useMutation({ mutationFn })
}

export function useDeleteLineItem() {
  const mutationFn = useConvexMutation(api.bills.deleteLineItem).withOptimisticUpdate(
    (localStore, args) => {
      for (const billId of activeBillIds(localStore)) {
        const snap = localStore.getQuery(api.bills.getBill, { id: billId })
        if (!snap || !snap.lineItems.some((li) => li._id === args.id)) continue
        localStore.setQuery(
          api.bills.getBill,
          { id: billId },
          {
            ...snap,
            lineItems: snap.lineItems.filter((li) => li._id !== args.id),
            assignments: snap.assignments.filter((a) => a.lineItemId !== args.id),
          },
        )
        return
      }
    },
  )
  return useMutation({ mutationFn })
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const PERSON_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

export function useAddPerson() {
  const mutationFn = useConvexMutation(api.bills.addPerson).withOptimisticUpdate(
    (localStore, args) => {
      const snap = localStore.getQuery(api.bills.getBill, { id: args.billId })
      if (!snap) return
      const person = {
        _id: tempId() as Id<'people'>,
        _creationTime: Date.now(),
        billId: args.billId,
        name: args.name,
        color: PERSON_COLORS[snap.people.length % PERSON_COLORS.length],
      }
      localStore.setQuery(
        api.bills.getBill,
        { id: args.billId },
        { ...snap, people: [...snap.people, person] },
      )
    },
  )
  return useMutation({ mutationFn })
}

export function useUpdatePerson() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.updatePerson) })
}

export function useDeletePerson() {
  const mutationFn = useConvexMutation(api.bills.deletePerson).withOptimisticUpdate(
    (localStore, args) => {
      for (const billId of activeBillIds(localStore)) {
        const snap = localStore.getQuery(api.bills.getBill, { id: billId })
        if (!snap || !snap.people.some((p) => p._id === args.id)) continue
        localStore.setQuery(
          api.bills.getBill,
          { id: billId },
          {
            ...snap,
            people: snap.people.filter((p) => p._id !== args.id),
            assignments: snap.assignments.filter((a) => a.personId !== args.id),
          },
        )
        return
      }
    },
  )
  return useMutation({ mutationFn })
}

// ---------------------------------------------------------------------------
// Assignments — optimistic toggle with equal-share rebalance (instant tap UX)
// ---------------------------------------------------------------------------

export function useToggleAssignment() {
  const mutationFn = useConvexMutation(api.bills.toggleAssignment).withOptimisticUpdate(
    (localStore, args) => {
      const snap = localStore.getQuery(api.bills.getBill, { id: args.billId })
      if (!snap) return
      const mine = snap.assignments.find(
        (a) => a.lineItemId === args.lineItemId && a.personId === args.personId,
      )
      let assignments = mine
        ? snap.assignments.filter((a) => a._id !== mine._id)
        : [
            ...snap.assignments,
            {
              _id: tempId() as Id<'assignments'>,
              _creationTime: Date.now(),
              billId: args.billId,
              lineItemId: args.lineItemId,
              personId: args.personId,
              shareFraction: 1,
            },
          ]
      const count = assignments.filter((a) => a.lineItemId === args.lineItemId).length
      const frac = count ? 1 / count : 0
      assignments = assignments.map((a) =>
        a.lineItemId === args.lineItemId ? { ...a, shareFraction: frac } : a,
      )
      localStore.setQuery(api.bills.getBill, { id: args.billId }, { ...snap, assignments })
    },
  )
  return useMutation({ mutationFn })
}

// ---------------------------------------------------------------------------
// Image upload + extraction (imperative; no optimistic update)
// ---------------------------------------------------------------------------

export function useGenerateUploadUrl() {
  return useMutation({ mutationFn: useConvexMutation(api.bills.generateUploadUrl) })
}

export function useAttachImageAndExtract() {
  return useMutation({
    mutationFn: useConvexMutation(api.bills.attachImageAndExtract),
  })
}

// Helper: the bill ids currently in the TanStack Query cache, so child mutations
// that only know their own id can find the snapshot to patch optimistically.
function activeBillIds(localStore: OptimisticLocalStore): Id<'bills'>[] {
  return localStore
    .getAllQueries(api.bills.getBill)
    .map((q) => q.args.id)
    .filter((id): id is Id<'bills'> => Boolean(id))
}
