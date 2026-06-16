import { d as useUpdateBillMeta, r as useAddPerson, s as useDeletePerson, t as billQueries, u as useToggleAssignment } from "./queries-CgP0X9X1.js";
import { t as Route } from "./split._billId-BktwG82W.js";
import { t as cn } from "./utils-C_uf36nf.js";
import { i as Separator, n as formatUsd, r as toUsd, t as formatLbp } from "./currency-CuDuwRYV.js";
import { t as Button } from "./button-BrHWO9iZ.js";
import { n as Input, t as Label } from "./label-CY1XVMQe.js";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { Switch } from "@base-ui/react/switch";
//#region src/components/ui/switch.tsx
function Switch$1({ className, size = "default", ...props }) {
	return /* @__PURE__ */ jsx(Switch.Root, {
		"data-slot": "switch",
		"data-size": size,
		className: cn("peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-5 data-[size=default]:w-11 data-[size=sm]:h-4 data-[size=sm]:w-7 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-unchecked:border-transparent data-unchecked:bg-input/90 data-disabled:cursor-not-allowed data-disabled:opacity-50", className),
		...props,
		children: /* @__PURE__ */ jsx(Switch.Thumb, {
			"data-slot": "switch-thumb",
			className: "pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform not-dark:bg-clip-padding group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-6 group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-4 data-checked:translate-x-[calc(100%-8px)] rtl:data-checked:-translate-x-[calc(100%-8px)] dark:data-checked:bg-primary-foreground data-unchecked:translate-x-0 rtl:data-unchecked:-translate-x-0 dark:data-unchecked:bg-foreground"
		})
	});
}
//#endregion
//#region src/components/PersonChips.tsx
function PersonChips({ people, onAdd, onRemove }) {
	const [name, setName] = useState("");
	function submit(e) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		onAdd(trimmed);
		setName("");
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap gap-2",
			children: [people.map((p) => /* @__PURE__ */ jsxs("span", {
				className: "inline-flex items-center gap-1.5 rounded-3xl py-1 pl-3 pr-1 text-sm font-medium text-white",
				style: { backgroundColor: p.color },
				children: [p.name, /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => onRemove(p._id),
					className: "rounded-full p-0.5 hover:bg-black/20",
					"aria-label": `Remove ${p.name}`,
					children: /* @__PURE__ */ jsx(RiCloseLine, { className: "size-3.5" })
				})]
			}, p._id)), people.length === 0 && /* @__PURE__ */ jsx("span", {
				className: "text-sm text-muted-foreground",
				children: "No one yet — add people to split with."
			})]
		}), /* @__PURE__ */ jsxs("form", {
			onSubmit: submit,
			className: "flex gap-2",
			children: [/* @__PURE__ */ jsx(Input, {
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: "Add a person"
			}), /* @__PURE__ */ jsx(Button, {
				type: "submit",
				variant: "outline",
				size: "icon",
				"aria-label": "Add person",
				children: /* @__PURE__ */ jsx(RiAddLine, {})
			})]
		})]
	});
}
//#endregion
//#region src/components/AssignGrid.tsx
function AssignGrid({ lineItems, people, assignments, rate, onToggle }) {
	function assigneesOf(lineItemId) {
		return new Set(assignments.filter((a) => a.lineItemId === lineItemId).map((a) => a.personId));
	}
	return /* @__PURE__ */ jsx("div", {
		className: "space-y-2",
		children: lineItems.map((li) => {
			const assigned = assigneesOf(li._id);
			return /* @__PURE__ */ jsxs("div", {
				className: "rounded-xl border border-border p-3 space-y-2",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "text-sm font-medium",
							children: [
								li.qty,
								"× ",
								li.name
							]
						}), /* @__PURE__ */ jsxs("div", {
							className: "text-sm tabular-nums",
							children: [formatLbp(li.lineTotal), rate ? /* @__PURE__ */ jsxs("span", {
								className: "text-muted-foreground",
								children: [
									" ",
									"· ",
									formatUsd(toUsd(li.lineTotal, rate))
								]
							}) : null]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap gap-1.5",
						children: [people.map((p) => {
							const on = assigned.has(p._id);
							return /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => onToggle(li._id, p._id),
								className: cn("rounded-3xl border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-transparent text-white" : "border-border text-muted-foreground hover:bg-muted"),
								style: on ? { backgroundColor: p.color } : void 0,
								children: p.name
							}, p._id);
						}), people.length === 0 && /* @__PURE__ */ jsx("span", {
							className: "text-xs text-muted-foreground",
							children: "Add people first."
						})]
					}),
					assigned.size > 1 && /* @__PURE__ */ jsxs("div", {
						className: "text-xs text-muted-foreground",
						children: [
							"Shared — split ",
							assigned.size,
							" ways"
						]
					}),
					assigned.size === 0 && people.length > 0 && /* @__PURE__ */ jsx("div", {
						className: "text-xs text-amber-600",
						children: "Unassigned"
					})
				]
			}, li._id);
		})
	});
}
//#endregion
//#region src/routes/split.$billId.tsx?tsr-split=component
function Split() {
	const billId = Route.useParams().billId;
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(billQueries.detail(billId));
	const { bill, lineItems, people, assignments } = data;
	const addPerson = useAddPerson();
	const deletePerson = useDeletePerson();
	const toggle = useToggleAssignment();
	const updateMeta = useUpdateBillMeta();
	const even = bill.serviceSplitMode === "even";
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto w-full max-w-md p-4 sm:p-6 space-y-5",
		children: [
			/* @__PURE__ */ jsx("h1", {
				className: "text-xl font-black",
				children: "Split"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ jsx(Label, { children: "People" }), /* @__PURE__ */ jsx(PersonChips, {
					people,
					onAdd: (name) => addPerson.mutate({
						billId,
						name
					}),
					onRemove: (id) => deletePerson.mutate({ id })
				})]
			}),
			/* @__PURE__ */ jsx(Separator, {}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ jsx(Label, { children: "Assign items" }), /* @__PURE__ */ jsx(AssignGrid, {
					lineItems,
					people,
					assignments,
					rate: bill.rate,
					onToggle: (lineItemId, personId) => toggle.mutate({
						billId,
						lineItemId,
						personId
					})
				})]
			}),
			/* @__PURE__ */ jsx(Separator, {}),
			/* @__PURE__ */ jsxs("label", {
				className: "flex items-center justify-between gap-4",
				children: [/* @__PURE__ */ jsxs("span", {
					className: "space-y-0.5",
					children: [/* @__PURE__ */ jsx("span", {
						className: "block text-sm font-medium",
						children: "Split service & tax evenly"
					}), /* @__PURE__ */ jsx("span", {
						className: "block text-xs text-muted-foreground",
						children: "Off = proportional to each person's items (the fair default)"
					})]
				}), /* @__PURE__ */ jsx(Switch$1, {
					checked: even,
					onCheckedChange: (checked) => updateMeta.mutate({
						id: billId,
						serviceSplitMode: checked ? "even" : "proportional"
					})
				})]
			}),
			/* @__PURE__ */ jsx(Button, {
				size: "lg",
				className: "w-full",
				disabled: people.length === 0,
				onClick: () => navigate({
					to: "/summary/$billId",
					params: { billId }
				}),
				children: "See totals"
			})
		]
	});
}
//#endregion
export { Split as component };
