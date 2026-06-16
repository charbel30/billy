import { t as billQueries } from "./queries-CgP0X9X1.js";
import { t as Route } from "./b._shareToken-DixNFiUu.js";
import { i as Separator, n as formatUsd, r as toUsd, t as formatLbp } from "./currency-CuDuwRYV.js";
import { n as CurrencyToggle, t as computePortfolios } from "./split-C51kYCdt.js";
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useSuspenseQuery } from "@tanstack/react-query";
//#region src/routes/b.$shareToken.tsx?tsr-split=component
function GuestView() {
	const { shareToken } = Route.useParams();
	const { data } = useSuspenseQuery(billQueries.byToken(shareToken));
	const { bill, lineItems, people, assignments } = data;
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
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto w-full max-w-md p-4 sm:p-6 space-y-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-xl font-black",
					children: bill.merchantName || "Receipt"
				}), bill.rate ? /* @__PURE__ */ jsxs("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"Rate ",
						formatLbp(bill.rate),
						" / $1 · ",
						bill.rateSource
					]
				}) : null] }), /* @__PURE__ */ jsx(CurrencyToggle, {
					value: currency,
					onChange: setCurrency
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "space-y-2",
				children: portfolios.map((p) => /* @__PURE__ */ jsxs("div", {
					className: "rounded-xl border border-border p-3",
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
				}, p.personId))
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
			/* @__PURE__ */ jsxs("details", {
				className: "text-sm",
				children: [/* @__PURE__ */ jsxs("summary", {
					className: "cursor-pointer text-muted-foreground",
					children: [
						"See all items (",
						lineItems.length,
						")"
					]
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-2 space-y-1",
					children: lineItems.map((li) => /* @__PURE__ */ jsxs("div", {
						className: "flex justify-between tabular-nums",
						children: [/* @__PURE__ */ jsxs("span", { children: [
							li.qty,
							"× ",
							li.name
						] }), /* @__PURE__ */ jsx("span", { children: fmt(li.lineTotal) })]
					}, li._id))
				})]
			})
		]
	});
}
//#endregion
export { GuestView as component };
