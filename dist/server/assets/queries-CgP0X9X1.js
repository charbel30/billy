import { useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { anyApi, componentsGeneric } from "convex/server";
//#region convex/_generated/api.js
/**
* Generated `api` utility.
*
* THIS CODE IS AUTOMATICALLY GENERATED.
*
* To regenerate, run `npx convex dev`.
* @module
*/
/**
* A utility for referencing Convex functions in your app's API.
*
* Usage:
* ```js
* const myFunctionReference = api.myModule.myFunction;
* ```
*/
var api = anyApi;
componentsGeneric();
//#endregion
//#region src/queries.ts
var billQueries = {
	detail: (id) => convexQuery(api.bills.getBill, { id }),
	byToken: (shareToken) => convexQuery(api.bills.getBillByToken, { shareToken })
};
var tempId = () => `temp_${Math.random().toString(36).slice(2)}`;
function useCreateBill() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.createBill) });
}
function useUpdateBillMeta() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.updateBillMeta).withOptimisticUpdate((localStore, args) => {
		const snap = localStore.getQuery(api.bills.getBill, { id: args.id });
		if (!snap) return;
		const { id, ...patch } = args;
		const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== void 0));
		localStore.setQuery(api.bills.getBill, { id: args.id }, {
			...snap,
			bill: {
				...snap.bill,
				...defined
			}
		});
	}) });
}
function useFinalizeShare() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.finalizeShare) });
}
function useAddLineItem() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.addLineItem).withOptimisticUpdate((localStore, args) => {
		const snap = localStore.getQuery(api.bills.getBill, { id: args.billId });
		if (!snap) return;
		const lineItem = {
			_id: tempId(),
			_creationTime: Date.now(),
			billId: args.billId,
			name: args.name,
			qty: args.qty,
			unitPrice: args.unitPrice,
			lineTotal: args.lineTotal ?? args.qty * args.unitPrice,
			currency: args.currency ?? snap.bill.currencyPrimary,
			confidence: args.confidence
		};
		localStore.setQuery(api.bills.getBill, { id: args.billId }, {
			...snap,
			lineItems: [...snap.lineItems, lineItem]
		});
	}) });
}
function useUpdateLineItem() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.updateLineItem).withOptimisticUpdate((localStore, args) => {
		const { id, ...patch } = args;
		const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== void 0));
		for (const billId of activeBillIds(localStore)) {
			const snap = localStore.getQuery(api.bills.getBill, { id: billId });
			if (!snap || !snap.lineItems.some((li) => li._id === id)) continue;
			localStore.setQuery(api.bills.getBill, { id: billId }, {
				...snap,
				lineItems: snap.lineItems.map((li) => li._id === id ? {
					...li,
					...defined
				} : li)
			});
			return;
		}
	}) });
}
function useDeleteLineItem() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.deleteLineItem).withOptimisticUpdate((localStore, args) => {
		for (const billId of activeBillIds(localStore)) {
			const snap = localStore.getQuery(api.bills.getBill, { id: billId });
			if (!snap || !snap.lineItems.some((li) => li._id === args.id)) continue;
			localStore.setQuery(api.bills.getBill, { id: billId }, {
				...snap,
				lineItems: snap.lineItems.filter((li) => li._id !== args.id),
				assignments: snap.assignments.filter((a) => a.lineItemId !== args.id)
			});
			return;
		}
	}) });
}
var PERSON_COLORS = [
	"#ef4444",
	"#f59e0b",
	"#10b981",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316"
];
function useAddPerson() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.addPerson).withOptimisticUpdate((localStore, args) => {
		const snap = localStore.getQuery(api.bills.getBill, { id: args.billId });
		if (!snap) return;
		const person = {
			_id: tempId(),
			_creationTime: Date.now(),
			billId: args.billId,
			name: args.name,
			color: PERSON_COLORS[snap.people.length % PERSON_COLORS.length]
		};
		localStore.setQuery(api.bills.getBill, { id: args.billId }, {
			...snap,
			people: [...snap.people, person]
		});
	}) });
}
function useDeletePerson() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.deletePerson).withOptimisticUpdate((localStore, args) => {
		for (const billId of activeBillIds(localStore)) {
			const snap = localStore.getQuery(api.bills.getBill, { id: billId });
			if (!snap || !snap.people.some((p) => p._id === args.id)) continue;
			localStore.setQuery(api.bills.getBill, { id: billId }, {
				...snap,
				people: snap.people.filter((p) => p._id !== args.id),
				assignments: snap.assignments.filter((a) => a.personId !== args.id)
			});
			return;
		}
	}) });
}
function useToggleAssignment() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.toggleAssignment).withOptimisticUpdate((localStore, args) => {
		const snap = localStore.getQuery(api.bills.getBill, { id: args.billId });
		if (!snap) return;
		const mine = snap.assignments.find((a) => a.lineItemId === args.lineItemId && a.personId === args.personId);
		let assignments = mine ? snap.assignments.filter((a) => a._id !== mine._id) : [...snap.assignments, {
			_id: tempId(),
			_creationTime: Date.now(),
			billId: args.billId,
			lineItemId: args.lineItemId,
			personId: args.personId,
			shareFraction: 1
		}];
		const count = assignments.filter((a) => a.lineItemId === args.lineItemId).length;
		const frac = count ? 1 / count : 0;
		assignments = assignments.map((a) => a.lineItemId === args.lineItemId ? {
			...a,
			shareFraction: frac
		} : a);
		localStore.setQuery(api.bills.getBill, { id: args.billId }, {
			...snap,
			assignments
		});
	}) });
}
function useGenerateUploadUrl() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.generateUploadUrl) });
}
function useAttachImageAndExtract() {
	return useMutation({ mutationFn: useConvexMutation(api.bills.attachImageAndExtract) });
}
function activeBillIds(localStore) {
	return localStore.getAllQueries(api.bills.getBill).map((q) => q.args.id).filter((id) => Boolean(id));
}
//#endregion
export { useCreateBill as a, useFinalizeShare as c, useUpdateBillMeta as d, useUpdateLineItem as f, useAttachImageAndExtract as i, useGenerateUploadUrl as l, useAddLineItem as n, useDeleteLineItem as o, useAddPerson as r, useDeletePerson as s, billQueries as t, useToggleAssignment as u };
