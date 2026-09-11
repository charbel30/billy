import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { RiArrowDownSLine, RiCheckLine, RiGroupLine, RiPieChartLine, RiReceiptLine } from '@remixicon/react'
import type { Id } from 'convex/_generated/dataModel'
import type { CSSProperties } from 'react'
import { cn } from '~/lib/utils'
import { ThemeToggle } from '~/components/shared/ThemeToggle'
import { Brand } from '~/components/shared/Brand'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { billQueries } from '~/api'
import { useHasHostToken } from '~/hooks/useHostAccess'
import { stepAvailability, type BillStep } from '~/lib/bill/steps'

const STEPS = [
  { to: '/review/$billId', label: 'Review', Icon: RiReceiptLine, step: 'review' },
  { to: '/split/$billId', label: 'Split', Icon: RiGroupLine, step: 'split' },
  { to: '/summary/$billId', label: 'Summary', Icon: RiPieChartLine, step: 'summary' },
] as const satisfies ReadonlyArray<{
  to: '/review/$billId' | '/split/$billId' | '/summary/$billId'
  label: string
  Icon: typeof RiReceiptLine
  step: BillStep
}>

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
    <header
      className={cn('z-30 px-4 py-2 sm:px-6', onLanding
        ? 'relative bg-background md:px-12 md:py-5'
        : 'sticky top-0 border-b border-border/60 bg-background/95 backdrop-blur-xl')}
      style={{ viewTransitionName: 'app-header' } as CSSProperties}
    >
      <div className={cn('mx-auto flex min-h-12 w-full items-center justify-between gap-3', onLanding ? 'max-w-[1120px]' : 'max-w-7xl')}>
        <Link to="/" aria-label="Spolio — home" className="brand-home flex min-h-11 shrink-0 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Brand compact={!!billNav} />
        </Link>
        {billNav && currentStep ? (
          <BillStepNav billId={billNav.billId} currentStep={currentStep} />
        ) : onLanding ? null : (
          <p className="hidden text-xs text-muted-foreground sm:block">A little less bill drama.</p>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}

function BillStepNav({
  billId,
  currentStep,
}: {
  billId: string
  currentStep: (typeof STEPS)[number]
}) {
  const id = billId as Id<'bills'>
  const hasToken = useHasHostToken(id)
  const { data: bill } = useQuery({
    ...billQueries.detail(id),
    enabled: hasToken,
  })
  const availability = bill ? stepAvailability(bill) : null

  return (
    <nav aria-label="Bill navigation" className="ml-auto">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Bill navigation, ${currentStep.label}`} className="flex min-h-11 items-center gap-2 rounded-full bg-card px-3 text-sm font-bold shadow-sm ring-1 ring-border/60 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4">
          <currentStep.Icon aria-hidden className="size-4 text-primary-strong" />
          {currentStep.label}
          <RiArrowDownSLine aria-hidden className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {STEPS.map(({ to, label, Icon, step }) => {
            const gate = availability?.[step]
            const enabled = gate?.enabled !== false
            return (
              <DropdownMenuItem
                key={to}
                className="min-h-12"
                disabled={!enabled}
                aria-disabled={!enabled}
                render={
                  enabled
                    ? (
                        <Link
                          to={to}
                          params={{ billId }}
                          activeOptions={{ exact: true }}
                          activeProps={{ 'aria-current': 'page' }}
                        />
                      )
                    : undefined
                }
              >
                <Icon aria-hidden className="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block">{label}</span>
                  {!enabled && gate?.reason ? (
                    <span className="block text-xs font-medium text-muted-foreground">
                      {gate.reason}
                    </span>
                  ) : null}
                </span>
                {currentStep.to === to ? <RiCheckLine aria-hidden className="size-4 text-primary-strong" /> : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
