import { t as Loader } from "./Loader-U2uc7iiC.js";
import { t as billQueries } from "./queries-CgP0X9X1.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { jsx } from "react/jsx-runtime";
//#region src/routes/summary.$billId.tsx
var $$splitComponentImporter = () => import("./summary._billId-CcDPqdZr.js");
var Route = createFileRoute("/summary/$billId")({
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	pendingComponent: () => /* @__PURE__ */ jsx(Loader, {}),
	loader: async ({ params, context: { queryClient } }) => {
		await queryClient.ensureQueryData(billQueries.detail(params.billId));
	}
});
//#endregion
export { Route as t };
