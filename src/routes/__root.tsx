/// <reference types="vite/client" />
import { ReactQueryDevtools } from "@tanstack/react-query-devtools/production";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { Toaster } from "react-hot-toast";
import type { QueryClient } from "@tanstack/react-query";
import { RiHistoryLine, RiWallet3Line } from "@remixicon/react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { DirectionProvider } from "~/components/ui/direction";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { appContent } from "~/lib/appContent";
import { seo } from "~/utils/seo";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Receipt Splitter — split a bill in LBP & USD",
        description: `Scan a Lebanese receipt, see it in both LBP and USD at the venue's rate, and split it item-by-item.`,
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <DirectionProvider direction="ltr">
          {children}
          <Toaster />
        </DirectionProvider>
        <ReactQueryDevtools />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto grid h-10 w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center">
          <Link
            to="/"
            aria-label="Go to scanner"
            className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 active:scale-95"
          >
            <RiWallet3Line className="size-5" />
          </Link>

          <Link to="/" className="text-base font-bold tracking-tight text-foreground">
            {appContent.name}
          </Link>

          <div className="flex items-center justify-end gap-2">
            <LoadingIndicator />
            <button
              type="button"
              aria-label="History"
              className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 active:scale-95"
            >
              <RiHistoryLine className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="grow flex flex-col">{children}</main>
    </div>
  );
}

function LoadingIndicator() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  return (
    <div
      className={`size-5 transition-all duration-300 ${
        isLoading ? `opacity-100 delay-300` : `opacity-0 delay-0`
      }`}
    >
      <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
