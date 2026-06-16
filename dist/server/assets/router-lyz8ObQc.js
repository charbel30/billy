import { t as Loader } from "./Loader-U2uc7iiC.js";
import { t as Route$3 } from "./summary._billId-IgEx4Hcv.js";
import { t as Route$4 } from "./split._billId-BktwG82W.js";
import { t as Route$5 } from "./review._billId-CSu3QwwI.js";
import { t as Route$6 } from "./b._shareToken-DixNFiUu.js";
import "react";
import { ErrorComponent, HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRouteWithContext, createRouter, lazyRouteComponent, useLocation, useRouter, useRouterState } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { MutationCache, QueryClient, notifyManager } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import toast, { Toaster } from "react-hot-toast";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools/production";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DirectionProvider } from "@base-ui/react/direction-provider";
//#region src/components/DefaultCatchBoundary.tsx
function DefaultCatchBoundary({ error }) {
	const router = useRouter();
	const isRoot = useLocation({ select: (location) => location.pathname === "/" });
	console.error(error);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6",
		children: [/* @__PURE__ */ jsx(ErrorComponent, { error }), /* @__PURE__ */ jsxs("div", {
			className: "flex gap-2 items-center flex-wrap",
			children: [/* @__PURE__ */ jsx("button", {
				onClick: () => {
					router.invalidate();
				},
				className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
				children: "Try Again"
			}), isRoot ? /* @__PURE__ */ jsx(Link, {
				to: "/",
				className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
				children: "Home"
			}) : /* @__PURE__ */ jsx(Link, {
				to: "/",
				className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
				onClick: (e) => {
					e.preventDefault();
					window.history.back();
				},
				children: "Go Back"
			})]
		})]
	});
}
//#endregion
//#region src/components/ui/direction.tsx
function DirectionProvider$1({ direction, children }) {
	return /* @__PURE__ */ jsx(DirectionProvider, {
		direction,
		children
	});
}
//#endregion
//#region src/components/NotFound.tsx
function NotFound({ children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-2 p-2",
		children: [/* @__PURE__ */ jsx("div", {
			className: "text-gray-600 dark:text-gray-400",
			children: children || /* @__PURE__ */ jsx("p", { children: "The page you are looking for does not exist." })
		}), /* @__PURE__ */ jsxs("p", {
			className: "flex items-center gap-2 flex-wrap",
			children: [/* @__PURE__ */ jsx("button", {
				onClick: () => window.history.back(),
				className: "bg-emerald-500 text-white px-2 py-1 rounded-sm uppercase font-black text-sm",
				children: "Go back"
			}), /* @__PURE__ */ jsx(Link, {
				to: "/",
				className: "bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm",
				children: "Start Over"
			})]
		})]
	});
}
//#endregion
//#region src/styles/app.css?url
var app_default = "/assets/app-C6886Dg-.css";
//#endregion
//#region src/utils/seo.ts
var seo = ({ title, description, keywords, image }) => {
	return [
		{ title },
		{
			name: "description",
			content: description
		},
		{
			name: "keywords",
			content: keywords
		},
		{
			name: "twitter:title",
			content: title
		},
		{
			name: "twitter:description",
			content: description
		},
		{
			name: "twitter:creator",
			content: "@tannerlinsley"
		},
		{
			name: "twitter:site",
			content: "@tannerlinsley"
		},
		{
			name: "og:type",
			content: "website"
		},
		{
			name: "og:title",
			content: title
		},
		{
			name: "og:description",
			content: description
		},
		...image ? [
			{
				name: "twitter:image",
				content: image
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				name: "og:image",
				content: image
			}
		] : []
	];
};
//#endregion
//#region src/routes/__root.tsx
var Route$2 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			...seo({
				title: "Receipt Splitter — split a bill in LBP & USD",
				description: `Scan a Lebanese receipt, see it in both LBP and USD at the venue's rate, and split it item-by-item.`
			})
		],
		links: [
			{
				rel: "stylesheet",
				href: app_default
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png"
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png"
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png"
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
				color: "#fffff"
			},
			{
				rel: "icon",
				href: "/favicon.ico"
			}
		]
	}),
	errorComponent: (props) => {
		return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(DefaultCatchBoundary, { ...props }) });
	},
	notFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
	component: RootComponent
});
function RootComponent() {
	return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [
			/* @__PURE__ */ jsx(DirectionProvider$1, {
				direction: "ltr",
				children: /* @__PURE__ */ jsxs("div", {
					className: "min-h-screen flex flex-col",
					children: [/* @__PURE__ */ jsx("header", {
						className: "bg-card border-b border-border flex items-center justify-between py-3 px-4 sm:px-6",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ jsxs(Link, {
								to: "/",
								className: "block leading-tight",
								children: [/* @__PURE__ */ jsx("div", {
									className: "font-black text-lg sm:text-xl text-foreground",
									children: "Receipt Splitter"
								}), /* @__PURE__ */ jsx("div", {
									className: "text-xs text-muted-foreground",
									children: "LBP & USD, split fairly"
								})]
							}), /* @__PURE__ */ jsx(LoadingIndicator, {})]
						})
					}), /* @__PURE__ */ jsxs("main", {
						className: "grow flex flex-col",
						children: [children, /* @__PURE__ */ jsx(Toaster, {})]
					})]
				})
			}),
			/* @__PURE__ */ jsx(ReactQueryDevtools, {}),
			/* @__PURE__ */ jsx(TanStackRouterDevtools, { position: "bottom-right" }),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
function LoadingIndicator() {
	return /* @__PURE__ */ jsx("div", {
		className: `h-12 transition-all duration-300 ${useRouterState({ select: (s) => s.isLoading }) ? `opacity-100 delay-300` : `opacity-0 delay-0`}`,
		children: /* @__PURE__ */ jsx(Loader, {})
	});
}
//#endregion
//#region src/routes/scan.tsx
var $$splitComponentImporter$1 = () => import("./scan-Dpy-iwb8.js");
var Route$1 = createFileRoute("/scan")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
//#endregion
//#region src/routes/index.tsx
var $$splitComponentImporter = () => import("./routes-AQohycD9.js");
var Route = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
//#endregion
//#region src/routeTree.gen.ts
var ScanRoute = Route$1.update({
	id: "/scan",
	path: "/scan",
	getParentRoute: () => Route$2
});
var IndexRoute = Route.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$2
});
var SummaryBillIdRoute = Route$3.update({
	id: "/summary/$billId",
	path: "/summary/$billId",
	getParentRoute: () => Route$2
});
var SplitBillIdRoute = Route$4.update({
	id: "/split/$billId",
	path: "/split/$billId",
	getParentRoute: () => Route$2
});
var ReviewBillIdRoute = Route$5.update({
	id: "/review/$billId",
	path: "/review/$billId",
	getParentRoute: () => Route$2
});
var rootRouteChildren = {
	IndexRoute,
	ScanRoute,
	BShareTokenRoute: Route$6.update({
		id: "/b/$shareToken",
		path: "/b/$shareToken",
		getParentRoute: () => Route$2
	}),
	ReviewBillIdRoute,
	SplitBillIdRoute,
	SummaryBillIdRoute
};
var routeTree = Route$2._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	if (typeof document !== "undefined") notifyManager.setScheduler(window.requestAnimationFrame);
	const convexQueryClient = new ConvexQueryClient("https://energized-monitor-613.eu-west-1.convex.cloud");
	const queryClient = new QueryClient({
		defaultOptions: { queries: {
			queryKeyHashFn: convexQueryClient.hashFn(),
			queryFn: convexQueryClient.queryFn()
		} },
		mutationCache: new MutationCache({ onError: (error) => {
			toast(error.message, { className: "bg-red-500 text-white" });
		} })
	});
	convexQueryClient.connect(queryClient);
	const router = createRouter({
		routeTree,
		defaultPreload: "intent",
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
		context: { queryClient },
		Wrap: ({ children }) => /* @__PURE__ */ jsx(ConvexProvider, {
			client: convexQueryClient.convexClient,
			children
		}),
		scrollRestoration: true
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient
	});
	return router;
}
//#endregion
export { getRouter };
