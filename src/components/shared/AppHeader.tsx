import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  RiGroupLine,
  RiPieChartLine,
  RiReceiptLine,
  RiWallet3Line,
} from "@remixicon/react";
import { cn } from "~/lib/utils";
import { pillSpring, appContent } from "~/lib/ui";
import { ThemeToggle } from "~/components/shared/ThemeToggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center">
        <div className="justify-self-start">
          <HeaderLeft />
        </div>
        <HeaderCenter />
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

// Brand sits on the left; on bill screens the centre owns the compact brand +
// step nav, so the left slot stays empty to keep the nav truly centred.
function HeaderLeft() {
  const onBill = useRouterState({
    select: (s) =>
      s.matches.some(
        (m) =>
          m.routeId === "/review/$billId" ||
          m.routeId === "/split/$billId" ||
          m.routeId === "/summary/$billId",
      ),
  });
  return onBill ? null : <BrandMark />;
}

// The Spolio logo — a primary monogram tile + wordmark; links home. `compact`
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

  if (!nav) {
    return null;
  }

  const { billId, step } = nav;
  const item = (active: boolean) =>
    cn(
      "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors",
      active ? "text-primary-strong" : "text-muted-foreground hover:text-foreground",
    );
  const pill = (
    <motion.span
      layoutId="header-step-pill"
      transition={pillSpring}
      className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-primary/25"
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
