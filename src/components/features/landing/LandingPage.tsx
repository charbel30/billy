import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { trackFunnelMilestone } from '~/lib/observability'
import { HeroSection } from './components/HeroSection'
import './landing.css'
import { Brand } from '~/components/shared/Brand'

export function LandingPage() {
  useEffect(() => {
    trackFunnelMilestone('landing')
  }, [])

  return (
    <div className="landing-page">
      <div className="landing-container">
        <HeroSection />
        <footer className="landing-footer">
          <Brand compact />
          <nav aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
