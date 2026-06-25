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
import { motion } from "motion/react";
import type { QueryClient } from "@tanstack/react-query";
import {
  RiGroupLine,
  RiPieChartLine,
  RiReceiptLine,
  RiWallet3Line,
} from "@remixicon/react";
import { cn } from "~/lib/utils";
import { setLastBill } from "~/lib/lastBill";
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
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center">
          <HeaderCenter />
        </div>
      </header>

      <main className="grow flex flex-col">{children}</main>
    </div>
  );
}

// The Billy logo — a primary monogram tile + wordmark; links home. `compact`
// keeps just the mark on small screens (used next to the step nav).
function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label={`${appContent.name} — home`}
      className="flex shrink-0 items-center gap-2 transition-transform active:scale-[0.96]"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <RiWallet3Line className="size-5" />
      </span>
      <span
        className={cn(
          "text-lg font-black tracking-tight text-foreground",
          compact && "hidden sm:inline",
        )}
      >
        {appContent.name}
      </span>
    </Link>
  );
}

// Turns the header's centre into contextual navigation: when you're on a bill
// (review/split/summary), it shows a segmented Review · Split · Summary switcher
// with a sliding active pill; everywhere else it falls back to the wordmark.
function HeaderCenter() {
  const nav = useRouterState({
    select: (s) => {
      for (const m of s.matches) {
        if (m.routeId === "/review/$billId")
          return { billId: (m.params as { billId: string }).billId, step: "review" as const };
        if (m.routeId === "/split/$billId")
          return { billId: (m.params as { billId: string }).billId, step: "split" as const };
        if (m.routeId === "/summary/$billId")
          return { billId: (m.params as { billId: string }).billId, step: "summary" as const };
      }
      return null;
    },
  });

  // Remember the bill in view so the scan page can offer a resume shortcut.
  React.useEffect(() => {
    if (nav) setLastBill(nav);
  }, [nav?.billId, nav?.step]);

  if (!nav) {
    return <BrandMark />;
  }

  const { billId, step } = nav;
  const item = (active: boolean) =>
    cn(
      "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );
  const pill = (
    <motion.span
      layoutId="header-step-pill"
      transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
      className="absolute inset-0 rounded-full bg-background shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-primary/25"
    />
  );

  return (
    <div className="flex items-center gap-2">
      <BrandMark compact />

      <nav className="flex items-center gap-0.5 rounded-full bg-muted p-1">
        <Link
          to="/review/$billId"
          params={{ billId }}
          aria-current={step === "review" ? "page" : undefined}
          className={item(step === "review")}
        >
          {step === "review" ? pill : null}
          <span className="relative z-10 flex items-center gap-1.5">
            <RiReceiptLine className="size-4" />
            Review
          </span>
        </Link>
        <Link
          to="/split/$billId"
          params={{ billId }}
          aria-current={step === "split" ? "page" : undefined}
          className={item(step === "split")}
        >
          {step === "split" ? pill : null}
          <span className="relative z-10 flex items-center gap-1.5">
            <RiGroupLine className="size-4" />
            Split
          </span>
        </Link>
        <Link
          to="/summary/$billId"
          params={{ billId }}
          aria-current={step === "summary" ? "page" : undefined}
          className={item(step === "summary")}
        >
          {step === "summary" ? pill : null}
          <span className="relative z-10 flex items-center gap-1.5">
            <RiPieChartLine className="size-4" />
            Summary
          </span>
        </Link>
      </nav>
    </div>
  );
}
