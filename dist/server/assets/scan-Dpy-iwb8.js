import { a as useCreateBill, i as useAttachImageAndExtract, l as useGenerateUploadUrl } from "./queries-CgP0X9X1.js";
import { a as CardTitle, i as CardHeader, n as CardContent, r as CardDescription, t as Card } from "./card-PUZRHvmt.js";
import { t as Button } from "./button-BrHWO9iZ.js";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { RiCameraLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import imageCompression from "browser-image-compression";
//#region src/routes/scan.tsx?tsr-split=component
function Scan() {
	const navigate = useNavigate();
	const createBill = useCreateBill();
	const generateUploadUrl = useGenerateUploadUrl();
	const attach = useAttachImageAndExtract();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	async function handleFile(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		setBusy(true);
		setError(null);
		try {
			const compressed = await imageCompression(file, {
				maxSizeMB: .8,
				maxWidthOrHeight: 2e3,
				useWebWorker: true
			});
			const billId = await createBill.mutateAsync({});
			const uploadUrl = await generateUploadUrl.mutateAsync({});
			const res = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": compressed.type },
				body: compressed
			});
			if (!res.ok) throw new Error("Upload failed");
			const { storageId } = await res.json();
			await attach.mutateAsync({
				billId,
				imageRef: storageId
			});
			navigate({
				to: "/review/$billId",
				params: { billId }
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setBusy(false);
		}
	}
	async function manual() {
		navigate({
			to: "/review/$billId",
			params: { billId: await createBill.mutateAsync({}) }
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto w-full max-w-md p-4 sm:p-6 space-y-5",
		children: [/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsxs(CardHeader, { children: [/* @__PURE__ */ jsx(CardTitle, { children: "Scan a receipt" }), /* @__PURE__ */ jsx(CardDescription, { children: "Point your camera at the bill. We compress it and read the items." })] }), /* @__PURE__ */ jsxs(CardContent, {
			className: "space-y-3",
			children: [/* @__PURE__ */ jsxs("label", {
				className: "block",
				children: [/* @__PURE__ */ jsx("input", {
					type: "file",
					accept: "image/*",
					capture: "environment",
					className: "hidden",
					disabled: busy,
					onChange: handleFile
				}), /* @__PURE__ */ jsx("span", {
					className: `inline-flex h-12 w-full items-center justify-center gap-2 rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-all ${busy ? "pointer-events-none opacity-60" : "hover:bg-primary/80 cursor-pointer"}`,
					children: busy ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(RiLoader4Line, { className: "animate-spin" }), " Uploading…"] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(RiCameraLine, {}), " Take / choose photo"] })
				})]
			}), error && /* @__PURE__ */ jsx("p", {
				className: "text-sm text-destructive",
				children: error
			})]
		})] }), /* @__PURE__ */ jsxs(Button, {
			variant: "outline",
			className: "w-full",
			onClick: manual,
			disabled: busy,
			children: [/* @__PURE__ */ jsx(RiPencilLine, {}), " Enter manually instead"]
		})]
	});
}
//#endregion
export { Scan as component };
