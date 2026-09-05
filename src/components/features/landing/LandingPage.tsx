import { useEffect } from 'react'
import { LegalFooter } from '~/components/shared/LegalFooter'
import { trackFunnelMilestone } from '~/lib/observability'
import { HeroSection } from './components/HeroSection'
import { HowItWorksSection } from './components/HowItWorksSection'
import { DualCurrencySection } from './components/DualCurrencySection'

export function LandingPage() {
  useEffect(() => {
    trackFunnelMilestone('landing')
  }, [])

  return (
    <div className="min-h-full bg-background px-4 pb-8 pt-4 text-foreground sm:px-6 md:px-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-16 md:max-w-5xl">
        <HeroSection />
        <HowItWorksSection />
        <DualCurrencySection />
        <LegalFooter />
      </div>
    </div>
  )
}
