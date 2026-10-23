/// <reference types="vite/client" />
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import * as React from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "react-hot-toast";
import type { QueryClient } from "@tanstack/react-query";
import { DefaultCatchBoundary } from "~/components/shared/DefaultCatchBoundary";
import { DirectionProvider } from "~/components/ui/direction";
import { NotFound } from "~/components/shared/NotFound";
import { AppHeader } from "~/components/shared/AppHeader";
import appCss from "~/styles/app.css?url";
import figtreeFont from "@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url";
import cascadiaFont from "@fontsource-variable/cascadia-mono/files/cascadia-mono-latin-wght-normal.woff2?url";
import { THEME_INIT_SCRIPT } from "~/lib/ui";
import { seo } from "~/lib/seo";

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
        // viewport-fit=cover exposes env(safe-area-inset-*) for the mobile dock.
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "application-name", content: "Spolio" },
      { name: "apple-mobile-web-app-title", content: "Spolio" },
      ...seo({
        title: "Spolio — split a bill in LBP & USD",
        description: `Scan a Lebanese receipt, see it in both LBP and USD at the venue's rate, and split it item-by-item.`,
        image: 'https://spolio.net/og-image.png?v=spolio-scoop-2',
        imageAlt: 'Spolio — snap the bill, tap your share. In dollars and lira.',
      }),
    ],
    links: [
      // These faces render the header and hero. Discover them with the HTML
      // instead of waiting for the stylesheet's font-face rules.
      { rel: "preload", href: figtreeFont, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: cascadiaFont, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png?v=spolio-scoop-1",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png?v=spolio-scoop-1",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png?v=spolio-scoop-1",
      },
      { rel: "manifest", href: "/site.webmanifest?v=spolio-scoop-1" },
      { rel: "icon", href: "/favicon.ico?v=spolio-scoop-1", sizes: "16x16 32x32 48x48" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=spolio-scoop-1", sizes: "any" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Applies the stored/system theme before first paint — prevents a
            light flash when the resolved theme is dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <DirectionProvider direction="ltr">
          {children}
          <Toaster
            containerStyle={{ viewTransitionName: 'none' }}
            toastOptions={{
              style: {
                background: "var(--card)",
                color: "var(--card-foreground)",
                boxShadow: "var(--shadow-raised)",
                borderRadius: "var(--radius-control)",
              },
            }}
          />
        </DirectionProvider>
        <React.Suspense fallback={null}>
          <Devtools />
        </React.Suspense>
        <CloudflareWebAnalytics />
        <Scripts />
      </body>
    </html>
  );
}

function CloudflareWebAnalytics() {
  const token = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim()
  const onPublicPage = useRouterState({
    select: (state) =>
      ['/', '/privacy', '/terms'].includes(state.location.pathname),
  })

  if (!token || !onPublicPage) return null

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      // Dynamic routes contain bill/share capabilities. Disabling SPA
      // measurement ensures Cloudflare sees only this initial public path.
      data-cf-beacon={JSON.stringify({ token, spa: false })}
    />
  )
}

// Devtools are dev-only: lazily imported behind import.meta.env.DEV so the
// packages are dead-code-eliminated from the production bundle rather than
// shipped and hidden. (They used to mount unconditionally, via the
// react-query-devtools "/production" build — visible to real users.)
const Devtools = import.meta.env.DEV
  ? React.lazy(async () => {
      const [{ ReactQueryDevtools }, { TanStackRouterDevtools }] =
        await Promise.all([
          import("@tanstack/react-query-devtools"),
          import("@tanstack/react-router-devtools"),
        ]);
      return {
        default: () => (
          <>
            <ReactQueryDevtools />
            <TanStackRouterDevtools position="bottom-right" />
          </>
        ),
      };
    })
  : () => null;

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <AppHeader />
        <main className="grow flex flex-col" style={{ viewTransitionName: 'page' }}>{children}</main>
      </div>
    </MotionConfig>
  );
}
