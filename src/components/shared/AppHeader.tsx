import { Link, useRouterState } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { RiGroupLine, RiPieChartLine, RiReceiptLine } from '@remixicon/react'
import { cn } from '~/lib/utils'
import { pillSpring } from '~/lib/ui'
import { ThemeToggle } from '~/components/shared/ThemeToggle'
import { Brand } from '~/components/shared/Brand'

const STEPS = [
  { step: 'review', to: '/review/$billId', label: 'Review', Icon: RiReceiptLine },
  { step: 'split', to: '/split/$billId', label: 'Split', Icon: RiGroupLine },
  { step: 'summary', to: '/summary/$billId', label: 'Summary', Icon: RiPieChartLine },
] as const

export function AppHeader() {
  const { onLanding, billNav } = useRouterState({
    select: (state) => {
      const match = state.matches.find((m) =>
        m.routeId === '/review/$billId' ||
        m.routeId === '/split/$billId' ||
        m.routeId === '/summary/$billId',
      )
      return {
        onLanding: state.location.pathname === '/',
        billNav: match && 'billId' in match.params
          ? { billId: match.params.billId, routeId: match.routeId }
          : null,
      }
    },
  })

  return (
    <header className={cn(
      'z-30 px-4 py-3 sm:px-6',
      onLanding
        ? 'relative bg-background md:px-12 md:py-5'
        : 'sticky top-0 border-b border-border/60 bg-background/95 backdrop-blur-xl',
    )}>
      <div className={cn(
        'mx-auto grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto_1fr]',
        onLanding ? 'max-w-[1120px]' : 'max-w-7xl',
      )}>
        <Link to="/" aria-label="Spolio — home" className="brand-home w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Brand />
        </Link>
        {billNav ? (
          <nav aria-label="Bill steps" className="col-span-2 row-start-2 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:rounded-full">
            {STEPS.map(({ step, to, label, Icon }) => {
              const active = billNav.routeId === to
              return (
                <Link
                  key={step}
                  to={to}
                  params={{ billId: billNav.billId }}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:rounded-full sm:px-4',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {active && <motion.span layoutId="header-step-pill" transition={pillSpring} className="absolute inset-0 rounded-xl bg-card shadow-sm ring-1 ring-border/60 sm:rounded-full" />}
                  <Icon aria-hidden="true" className={cn('relative size-4', active && 'text-primary-strong')} />
                  <span className="relative">{label}</span>
                </Link>
              )
            })}
          </nav>
        ) : (
          <p className="hidden text-xs text-muted-foreground sm:block">A little less bill drama.</p>
        )}
        <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
