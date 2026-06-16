import { a as useCreateBill } from "./queries-CgP0X9X1.js";
import { a as CardTitle, i as CardHeader, n as CardContent, r as CardDescription, t as Card } from "./card-PUZRHvmt.js";
import { t as Button } from "./button-BrHWO9iZ.js";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { RiCameraLine, RiPencilLine } from "@remixicon/react";
//#region src/routes/index.tsx?tsr-split=component
function Home() {
	const navigate = useNavigate();
	const createBill = useCreateBill();
	async function startManual() {
		navigate({
			to: "/review/$billId",
			params: { billId: await createBill.mutateAsync({}) }
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto w-full max-w-md p-4 sm:p-6 space-y-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "text-2xl font-black",
					children: "Split a receipt"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-muted-foreground text-sm",
					children: "Photograph a bill or type it in. See it in LBP & USD at the venue's rate, then split item-by-item."
				})]
			}),
			/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsxs(CardHeader, { children: [/* @__PURE__ */ jsx(CardTitle, { children: "Scan a receipt" }), /* @__PURE__ */ jsx(CardDescription, { children: "Use your camera — we read the items for you." })] }), /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs(Button, {
				size: "lg",
				className: "w-full",
				onClick: () => navigate({ to: "/scan" }),
				children: [/* @__PURE__ */ jsx(RiCameraLine, {}), " Scan"]
			}) })] }),
			/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsxs(CardHeader, { children: [/* @__PURE__ */ jsx(CardTitle, { children: "Enter manually" }), /* @__PURE__ */ jsx(CardDescription, { children: "No photo? Type the bill in. Works offline at the table." })] }), /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs(Button, {
				size: "lg",
				variant: "outline",
				className: "w-full",
				onClick: startManual,
				disabled: createBill.isPending,
				children: [/* @__PURE__ */ jsx(RiPencilLine, {}), " Enter manually"]
			}) })] })
		]
	});
}
//#endregion
export { Home as component };
