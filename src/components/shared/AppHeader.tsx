import { Link, useRouterState } from '@tanstack/react-router'
import { RiArrowDownSLine, RiCheckLine, RiGroupLine, RiPieChartLine, RiReceiptLine } from '@remixicon/react'
import { cn } from '~/lib/utils'
import { ThemeToggle } from '~/components/shared/ThemeToggle'
import { Brand } from '~/components/shared/Brand'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'

const STEPS = [
  { to: '/review/$billId', label: 'Review', Icon: RiReceiptLine },
  { to: '/split/$billId', label: 'Split', Icon: RiGroupLine },
  { to: '/summary/$billId', label: 'Summary', Icon: RiPieChartLine },
] as const

// Mounted once by the root layout, above Outlet. Route state supplies the
// current step and bill id; links preserve normal router/history behavior.
export function AppHeader() {
  const { onLanding, billNav } = useRouterState({
    select: (state) => {
      const match = state.matches.find((m) =>
        m.routeId === '/review/$billId' || m.routeId === '/split/$billId' || m.routeId === '/summary/$billId',
      )
      return {
        onLanding: state.location.pathname === '/',
        billNav: match && 'billId' in match.params
          ? { billId: match.params.billId, routeId: match.routeId }
          : null,
      }
    },
  })
  const currentStep = STEPS.find((step) => step.to === billNav?.routeId)

  return (
    <header className={cn('z-30 px-4 py-2 sm:px-6', onLanding
      ? 'relative bg-background md:px-12 md:py-5'
      : 'sticky top-0 border-b border-border/60 bg-background/95 backdrop-blur-xl')}>
      <div className={cn('mx-auto flex min-h-12 w-full items-center justify-between gap-3', onLanding ? 'max-w-[1120px]' : 'max-w-7xl')}>
        <Link to="/" aria-label="Spolio — home" className="brand-home flex min-h-11 shrink-0 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Brand compact={!!billNav} />
        </Link>
        {billNav && currentStep ? (
          <nav aria-label="Bill navigation" className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={`Bill navigation, ${currentStep.label}`} className="flex min-h-11 items-center gap-2 rounded-full bg-card px-3 text-sm font-bold shadow-sm ring-1 ring-border/60 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4">
                <currentStep.Icon aria-hidden className="size-4 text-primary-strong" />
                {currentStep.label}
                <RiArrowDownSLine aria-hidden className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {STEPS.map(({ to, label, Icon }) => (
                  <DropdownMenuItem key={to} className="min-h-12" render={<Link to={to} params={{ billId: billNav.billId }} activeOptions={{ exact: true }} activeProps={{ 'aria-current': 'page' }} />}>
                    <Icon aria-hidden className="size-4" />
                    <span className="flex-1">{label}</span>
                    {currentStep.to === to ? <RiCheckLine aria-hidden className="size-4 text-primary-strong" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        ) : <p className="hidden text-xs text-muted-foreground sm:block">A little less bill drama.</p>}
        <ThemeToggle />
      </div>
    </header>
  )
}
