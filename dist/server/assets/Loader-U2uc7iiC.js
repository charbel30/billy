import { jsx } from "react/jsx-runtime";
//#region src/components/Loader.tsx
function Loader() {
	return /* @__PURE__ */ jsx("div", {
		className: "flex h-full",
		children: /* @__PURE__ */ jsx("div", { className: "m-auto border-gray-300 h-20 max-h-full aspect-square animate-spin rounded-full border-8 border-t-slate-900" })
	});
}
//#endregion
export { Loader as t };
