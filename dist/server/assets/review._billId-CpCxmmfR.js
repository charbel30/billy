import { d as useUpdateBillMeta, f as useUpdateLineItem, n as useAddLineItem, o as useDeleteLineItem, t as billQueries } from "./queries-CgP0X9X1.js";
import { t as Route } from "./review._billId-CSu3QwwI.js";
import { t as cn } from "./utils-C_uf36nf.js";
import { i as Separator, n as formatUsd, r as toUsd, t as formatLbp } from "./currency-CuDuwRYV.js";
import { t as Button } from "./button-BrHWO9iZ.js";
import { n as Input, t as Label } from "./label-CY1XVMQe.js";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RiAddLine, RiDeleteBinLine, RiErrorWarningLine, RiLoader4Line } from "@remixicon/react";
import { cva } from "class-variance-authority";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
//#region src/components/ui/badge.tsx
var badgeVariants = cva("group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-3xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!", {
	variants: { variant: {
		default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
		secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
		destructive: "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
		outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
		ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
		link: "text-primary underline-offset-4 hover:underline"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant = "default", render, ...props }) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps({ className: cn(badgeVariants({ variant }), className) }, props),
		render,
		state: {
			slot: "badge",
			variant
		}
	});
}
//#endregion
//#region src/components/ReceiptTable.tsx
var LOW_CONFIDENCE = .6;
function EditableCell({ value, onCommit, numeric, className, ariaLabel }) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	return /* @__PURE__ */ jsx(Input, {
		"aria-label": ariaLabel,
		inputMode: numeric ? "decimal" : void 0,
		className: cn("h-8", className),
		value: draft,
		onChange: (e) => setDraft(e.target.value),
		onBlur: () => {
			if (draft !== String(value)) onCommit(draft);
		}
	});
}
function ReceiptTable({ lineItems, rate, onUpdate, onDelete, onAdd }) {
	const [draft, setDraft] = useState({
		name: "",
		qty: 1,
		unitPrice: 0
	});
	function num(raw) {
		const n = Number(raw.replace(/[^0-9.-]/g, ""));
		return Number.isFinite(n) ? n : 0;
	}
	function addRow(e) {
		e.preventDefault();
		if (!draft.name.trim()) return;
		onAdd({
			...draft,
			name: draft.name.trim()
		});
		setDraft({
			name: "",
			qty: 1,
			unitPrice: 0
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-2",
		children: [lineItems.map((li) => {
			const low = li.confidence != null && li.confidence < LOW_CONFIDENCE;
			return /* @__PURE__ */ jsxs("div", {
				className: cn("rounded-xl border p-2.5 space-y-2", low ? "border-amber-400 bg-amber-50" : "border-border"),
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ jsx(EditableCell, {
								ariaLabel: "Item name",
								value: li.name,
								onCommit: (raw) => onUpdate(li._id, { name: raw }),
								className: "flex-1"
							}),
							low && /* @__PURE__ */ jsx(Badge, {
								variant: "destructive",
								className: "shrink-0",
								children: "check"
							}),
							/* @__PURE__ */ jsx(Button, {
								variant: "ghost",
								size: "icon-sm",
								onClick: () => onDelete(li._id),
								"aria-label": "Delete item",
								children: /* @__PURE__ */ jsx(RiDeleteBinLine, {})
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-[3rem_1fr_1fr] items-center gap-2",
						children: [
							/* @__PURE__ */ jsx(EditableCell, {
								ariaLabel: "Quantity",
								numeric: true,
								value: li.qty,
								onCommit: (raw) => {
									const qty = num(raw);
									onUpdate(li._id, {
										qty,
										lineTotal: qty * li.unitPrice
									});
								}
							}),
							/* @__PURE__ */ jsx(EditableCell, {
								ariaLabel: "Unit price",
								numeric: true,
								value: li.unitPrice,
								onCommit: (raw) => {
									const unitPrice = num(raw);
									onUpdate(li._id, {
										unitPrice,
										lineTotal: li.qty * unitPrice
									});
								}
							}),
							/* @__PURE__ */ jsx(EditableCell, {
								ariaLabel: "Line total",
								numeric: true,
								value: li.lineTotal,
								onCommit: (raw) => onUpdate(li._id, { lineTotal: num(raw) })
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-[3rem_1fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground",
						children: [
							/* @__PURE__ */ jsx("span", { children: "qty" }),
							/* @__PURE__ */ jsx("span", { children: "unit (LL)" }),
							/* @__PURE__ */ jsxs("span", { children: ["total (LL)", rate ? ` · ${formatUsd(toUsd(li.lineTotal, rate))}` : ""] })
						]
					})
				]
			}, li._id);
		}), /* @__PURE__ */ jsxs("form", {
			onSubmit: addRow,
			className: "rounded-xl border border-dashed border-border p-2.5 space-y-2",
			children: [/* @__PURE__ */ jsx(Input, {
				placeholder: "Add an item…",
				value: draft.name,
				onChange: (e) => setDraft({
					...draft,
					name: e.target.value
				}),
				className: "h-8"
			}), /* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-2",
				children: [
					/* @__PURE__ */ jsx(Input, {
						"aria-label": "New quantity",
						inputMode: "decimal",
						className: "h-8",
						value: String(draft.qty),
						onChange: (e) => setDraft({
							...draft,
							qty: num(e.target.value)
						})
					}),
					/* @__PURE__ */ jsx(Input, {
						"aria-label": "New unit price",
						inputMode: "decimal",
						className: "h-8",
						value: String(draft.unitPrice),
						onChange: (e) => setDraft({
							...draft,
							unitPrice: num(e.target.value)
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "text-sm tabular-nums text-muted-foreground self-center",
						children: ["= ", (draft.qty * draft.unitPrice).toLocaleString("en-US")]
					}),
					/* @__PURE__ */ jsx(Button, {
						type: "submit",
						variant: "outline",
						size: "icon-sm",
						"aria-label": "Add item",
						children: /* @__PURE__ */ jsx(RiAddLine, {})
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/components/ui/alert.tsx
var alertVariants = cva("group/alert relative grid w-full gap-0.5 rounded-2xl border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pe-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4", {
	variants: { variant: {
		default: "bg-card text-card-foreground",
		destructive: "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current"
	} },
	defaultVariants: { variant: "default" }
});
function Alert({ className, variant, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		"data-slot": "alert",
		role: "alert",
		className: cn(alertVariants({ variant }), className),
		...props
	});
}
function AlertTitle({ className, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		"data-slot": "alert-title",
		className: cn("font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground", className),
		...props
	});
}
function AlertDescription({ className, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		"data-slot": "alert-description",
		className: cn("text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4", className),
		...props
	});
}
//#endregion
//#region src/components/ReconcileBanner.tsx
function ReconcileBanner({ result }) {
	if (result.printed === null || result.ok) return null;
	const diff = result.diff ?? 0;
	const over = diff > 0;
	return /* @__PURE__ */ jsxs(Alert, {
		variant: "destructive",
		children: [
			/* @__PURE__ */ jsx(RiErrorWarningLine, {}),
			/* @__PURE__ */ jsx(AlertTitle, { children: "Items don't match the printed total" }),
			/* @__PURE__ */ jsxs(AlertDescription, { children: [
				"Items + service + tax = ",
				formatLbp(result.computed),
				", but the receipt says",
				" ",
				formatLbp(result.printed),
				" — ",
				over ? "over" : "under",
				" by",
				" ",
				formatLbp(Math.abs(diff)),
				". Fix a quantity or price below."
			] })
		]
	});
}
//#endregion
//#region src/lib/reconcile.ts
var DEFAULT_TOLERANCE = 1e3;
function reconcile(input, tolerance = DEFAULT_TOLERANCE) {
	const computed = input.lineItems.reduce((sum, li) => sum + (li.lineTotal || 0), 0) + (input.serviceCharge || 0) + (input.tax || 0);
	const printed = input.printedTotal ?? null;
	if (printed === null) return {
		computed,
		printed: null,
		diff: null,
		ok: true
	};
	const diff = computed - printed;
	return {
		computed,
		printed,
		diff,
		ok: Math.abs(diff) <= tolerance
	};
}
//#endregion
//#region src/routes/review.$billId.tsx?tsr-split=component
function Field({ label, value, onCommit, numeric, placeholder }) {
	const [draft, setDraft] = useState(value == null ? "" : String(value));
	useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-1",
		children: [/* @__PURE__ */ jsx(Label, { children: label }), /* @__PURE__ */ jsx(Input, {
			inputMode: numeric ? "decimal" : void 0,
			placeholder,
			value: draft,
			onChange: (e) => setDraft(e.target.value),
			onBlur: () => {
				if (draft !== (value == null ? "" : String(value))) onCommit(draft);
			}
		})]
	});
}
var STATUS_VARIANT = {
	DRAFT: "secondary",
	NEEDS_REVIEW: "destructive",
	READY: "default",
	SHARED: "outline"
};
function Review() {
	const billId = Route.useParams().billId;
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(billQueries.detail(billId));
	const { bill, lineItems } = data;
	const updateMeta = useUpdateBillMeta();
	const addItem = useAddLineItem();
	const updateItem = useUpdateLineItem();
	const deleteItem = useDeleteLineItem();
	const num = (raw) => {
		const n = Number(raw.replace(/[^0-9.-]/g, ""));
		return Number.isFinite(n) ? n : 0;
	};
	const recon = reconcile({
		lineItems,
		serviceCharge: bill.serviceCharge,
		tax: bill.tax,
		printedTotal: bill.printedTotalLbp ?? null
	});
	const extracting = Boolean(bill.imageRef) && lineItems.length === 0;
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto w-full max-w-md p-4 sm:p-6 space-y-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-xl font-black",
					children: "Review"
				}), /* @__PURE__ */ jsx(Badge, {
					variant: STATUS_VARIANT[bill.status],
					children: bill.status.replace("_", " ")
				})]
			}),
			extracting && /* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ jsx(RiLoader4Line, { className: "animate-spin" }), " Reading your receipt…"]
			}),
			/* @__PURE__ */ jsx(Field, {
				label: "Merchant",
				value: bill.merchantName,
				placeholder: "Restaurant name",
				onCommit: (raw) => updateMeta.mutate({
					id: billId,
					merchantName: raw
				})
			}),
			/* @__PURE__ */ jsx(ReconcileBanner, { result: recon }),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ jsx(Label, { children: "Items" }), /* @__PURE__ */ jsx(ReceiptTable, {
					lineItems,
					rate: bill.rate,
					onUpdate: (id, patch) => updateItem.mutate({
						id,
						...patch
					}),
					onDelete: (id) => deleteItem.mutate({ id }),
					onAdd: (item) => addItem.mutate({
						billId,
						...item
					})
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ jsx(Field, {
					label: "Service charge (LL)",
					numeric: true,
					value: bill.serviceCharge,
					onCommit: (raw) => updateMeta.mutate({
						id: billId,
						serviceCharge: num(raw)
					})
				}), /* @__PURE__ */ jsx(Field, {
					label: "Tax (LL)",
					numeric: true,
					value: bill.tax,
					onCommit: (raw) => updateMeta.mutate({
						id: billId,
						tax: num(raw)
					})
				})]
			}),
			/* @__PURE__ */ jsx(Separator, {}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ jsx(Label, { children: "Printed totals (drives the LBP/USD rate)" }),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ jsx(Field, {
							label: "Total LL",
							numeric: true,
							value: bill.printedTotalLbp,
							placeholder: "e.g. 19440000",
							onCommit: (raw) => updateMeta.mutate({
								id: billId,
								printedTotalLbp: num(raw)
							})
						}), /* @__PURE__ */ jsx(Field, {
							label: "Total $",
							numeric: true,
							value: bill.printedTotalUsd,
							placeholder: "e.g. 216",
							onCommit: (raw) => updateMeta.mutate({
								id: billId,
								printedTotalUsd: num(raw)
							})
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "text-sm text-muted-foreground",
						children: bill.rate ? `Rate: ${formatLbp(bill.rate)} / $1 · source: ${bill.rateSource}` : "No rate yet — enter both printed totals, or set one manually below."
					}),
					/* @__PURE__ */ jsx(Field, {
						label: "Manual rate (LL per $1)",
						numeric: true,
						value: bill.rateSource === "manual" ? bill.rate : void 0,
						placeholder: "override",
						onCommit: (raw) => updateMeta.mutate({
							id: billId,
							rate: num(raw),
							rateSource: "manual"
						})
					})
				]
			}),
			/* @__PURE__ */ jsx(Separator, {}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between text-sm",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-muted-foreground",
					children: "Computed total"
				}), /* @__PURE__ */ jsxs("span", {
					className: "font-medium tabular-nums",
					children: [formatLbp(recon.computed), bill.rate ? ` · ${formatUsd(toUsd(recon.computed, bill.rate))}` : ""]
				})]
			}),
			/* @__PURE__ */ jsx(Button, {
				size: "lg",
				className: "w-full",
				disabled: lineItems.length === 0,
				onClick: () => navigate({
					to: "/split/$billId",
					params: { billId }
				}),
				children: "Continue to split"
			})
		]
	});
}
//#endregion
export { Review as component };
