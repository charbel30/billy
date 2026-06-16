import { c as useFinalizeShare, t as billQueries } from "./queries-CgP0X9X1.js";
import { t as Route } from "./summary._billId-IgEx4Hcv.js";
import { i as Separator, n as formatUsd, r as toUsd, t as formatLbp } from "./currency-CuDuwRYV.js";
import { n as CurrencyToggle, t as computePortfolios } from "./split-C51kYCdt.js";
import { t as Button } from "./button-BrHWO9iZ.js";
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useSuspenseQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { RiFileCopyLine } from "@remixicon/react";
//#region src/routes/summary.$billId.tsx?tsr-split=component
function Summary() {
	const billId = Route.useParams().billId;
	const { data } = useSuspenseQuery(billQueries.detail(billId));
	const { bill, lineItems, people, assignments } = data;
	const finalize = useFinalizeShare();
	const [currency, setCurrency] = useState("LBP");
	const portfolios = computePortfolios({
		lineItems,
		people,
		assignments,
		serviceCharge: bill.serviceCharge,
		tax: bill.tax,
		rate: bill.rate,
		serviceSplitMode: bill.serviceSplitMode
	});
	const grandLbp = portfolios.reduce((s, p) => s + p.totalLbp, 0);
	const fmt = (lbp) => currency === "LBP" ? formatLbp(lbp) : formatUsd(toUsd(lbp, bill.rate));
	async function copyLink() {
		await finalize.mutateAsync({ id: billId });
		const url = `${window.location.origin}/b/${bill.shareToken}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Share link copied");
		} catch {
			toast(url);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto w-full max-w-md p-4 sm:p-6 space-y-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-xl font-black",
					children: "Totals"
				}), /* @__PURE__ */ jsx(CurrencyToggle, {
					value: currency,
					onChange: setCurrency
				})]
			}),
			!bill.rate && currency === "USD" && /* @__PURE__ */ jsx("p", {
				className: "text-sm text-amber-600",
				children: "No rate set — USD amounts show as $0.00. Add printed totals on the review screen."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [portfolios.map((p) => /* @__PURE__ */ jsxs("div", {
					className: "rounded-xl border border-border p-3 space-y-1",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "inline-flex items-center gap-2 text-sm font-medium",
							children: [/* @__PURE__ */ jsx("span", {
								className: "size-3 rounded-full",
								style: { backgroundColor: p.color }
							}), p.name]
						}), /* @__PURE__ */ jsx("span", {
							className: "font-semibold tabular-nums",
							children: fmt(p.totalLbp)
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "text-xs text-muted-foreground tabular-nums",
						children: [
							"items ",
							fmt(p.subtotalLbp),
							" · service/tax ",
							fmt(p.serviceShareLbp)
						]
					})]
				}, p.personId)), portfolios.length === 0 && /* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted-foreground",
					children: "No people to show."
				})]
			}),
			/* @__PURE__ */ jsx(Separator, {}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-muted-foreground",
					children: "Grand total"
				}), /* @__PURE__ */ jsx("span", {
					className: "text-lg font-black tabular-nums",
					children: fmt(grandLbp)
				})]
			}),
			/* @__PURE__ */ jsxs(Button, {
				size: "lg",
				className: "w-full",
				onClick: copyLink,
				disabled: finalize.isPending,
				children: [/* @__PURE__ */ jsx(RiFileCopyLine, {}), " Copy share link"]
			})
		]
	});
}
//#endregion
export { Summary as component };
