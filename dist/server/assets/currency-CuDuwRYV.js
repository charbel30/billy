import { t as cn } from "./utils-C_uf36nf.js";
import { jsx } from "react/jsx-runtime";
import { Separator } from "@base-ui/react/separator";
//#region src/components/ui/separator.tsx
function Separator$1({ className, orientation = "horizontal", ...props }) {
	return /* @__PURE__ */ jsx(Separator, {
		"data-slot": "separator",
		orientation,
		className: cn("shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch", className),
		...props
	});
}
//#endregion
//#region src/lib/currency.ts
/** Convert an LBP amount to USD at the given rate (LBP per USD). */
function toUsd(lbp, rate) {
	if (!rate) return 0;
	return lbp / rate;
}
/** Format LBP: thousands separators, no decimals (spec §4.2). */
function formatLbp(lbp) {
	return `${Math.round(lbp).toLocaleString("en-US")} LL`;
}
/** Format USD: leading symbol, 2 decimals. */
function formatUsd(usd) {
	return `$${usd.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}`;
}
//#endregion
export { Separator$1 as i, formatUsd as n, toUsd as r, formatLbp as t };
