import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { trackFunnelMilestone } from '~/lib/observability'
import { HeroSection } from './components/HeroSection'
import { HowItWorksSection } from './components/HowItWorksSection'
import './landing.css'

export function LandingPage() {
  useEffect(() => {
    trackFunnelMilestone('landing')
  }, [])

  return (
    <div className="landing-page">
      <div className="landing-container">
        <HeroSection />
        <HowItWorksSection />
        <footer className="landing-footer">
          <p>Made for meals with friends. Built for Lebanon.</p>
          <nav aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
