import { t as cn } from "./utils-C_uf36nf.js";
import { r as toUsd } from "./currency-CuDuwRYV.js";
import { jsx } from "react/jsx-runtime";
//#region src/components/CurrencyToggle.tsx
function CurrencyToggle({ value, onChange, className }) {
	return /* @__PURE__ */ jsx("div", {
		className: cn("inline-flex rounded-3xl border border-border p-0.5", className),
		children: ["LBP", "USD"].map((c) => /* @__PURE__ */ jsx("button", {
			type: "button",
			onClick: () => onChange(c),
			className: cn("px-3 py-1 text-sm rounded-3xl transition-colors", value === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"),
			children: c
		}, c))
	});
}
//#endregion
//#region src/lib/split.ts
/** Round `values` to integers summing exactly to `target` (largest-remainder).
*  Keeps per-person totals from drifting a few LL off the bill total. */
function roundToTarget(values, target) {
	const floored = values.map((v) => Math.floor(v));
	const result = [...floored];
	let remainder = Math.round(target - floored.reduce((s, v) => s + v, 0));
	const byFrac = values.map((v, i) => ({
		i,
		frac: v - Math.floor(v)
	})).sort((a, b) => b.frac - a.frac);
	for (let k = 0; remainder > 0 && k < byFrac.length; k++, remainder--) result[byFrac[k].i] += 1;
	return result;
}
function computePortfolios(input) {
	const { lineItems, people, assignments, serviceCharge, tax, rate, serviceSplitMode } = input;
	const itemById = new Map(lineItems.map((li) => [li._id, li]));
	const subtotal = new Map(people.map((p) => [p._id, 0]));
	for (const a of assignments) {
		const li = itemById.get(a.lineItemId);
		if (!li || !subtotal.has(a.personId)) continue;
		subtotal.set(a.personId, (subtotal.get(a.personId) ?? 0) + li.lineTotal * a.shareFraction);
	}
	const totalSubtotal = [...subtotal.values()].reduce((s, v) => s + v, 0);
	const extras = (serviceCharge || 0) + (tax || 0);
	const serviceShare = /* @__PURE__ */ new Map();
	for (const p of people) if (serviceSplitMode === "even") serviceShare.set(p._id, people.length ? extras / people.length : 0);
	else {
		const sub = subtotal.get(p._id) ?? 0;
		serviceShare.set(p._id, totalSubtotal > 0 ? extras * (sub / totalSubtotal) : 0);
	}
	const roundedTotals = roundToTarget(people.map((p) => (subtotal.get(p._id) ?? 0) + (serviceShare.get(p._id) ?? 0)), totalSubtotal + extras);
	return people.map((p, i) => {
		const totalLbp = roundedTotals[i];
		const sub = Math.round(subtotal.get(p._id) ?? 0);
		return {
			personId: p._id,
			name: p.name,
			color: p.color,
			subtotalLbp: sub,
			serviceShareLbp: totalLbp - sub,
			totalLbp,
			totalUsd: toUsd(totalLbp, rate)
		};
	});
}
//#endregion
export { CurrencyToggle as n, computePortfolios as t };
