import { t as Loader } from "./Loader-U2uc7iiC.js";
import { t as billQueries } from "./queries-CgP0X9X1.js";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { jsx } from "react/jsx-runtime";
//#region src/routes/b.$shareToken.tsx
var $$splitComponentImporter = () => import("./b._shareToken-CbDfJpPR.js");
var Route = createFileRoute("/b/$shareToken")({
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	pendingComponent: () => /* @__PURE__ */ jsx(Loader, {}),
	loader: async ({ params, context: { queryClient } }) => {
		await queryClient.ensureQueryData(billQueries.byToken(params.shareToken));
	}
});
//#endregion
export { Route as t };
