import { ScanReceiptActions } from '~/components/features/scan/ScanReceiptActions'
import { RecentBills } from '~/components/features/scan/components/RecentBills'
import { heroCopy } from '../content'
import { ReceiptPlayground } from './ReceiptPlayground'

export function HeroSection() {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-pitch">
        <p className="landing-eyebrow landing-enter">{heroCopy.badge}</p>
        <h1 id="landing-title" className="landing-title landing-enter">
          {heroCopy.headline[0]}<br />
          <span>{heroCopy.headline[1]}</span>
        </h1>
        <ScanReceiptActions />
        <RecentBills />
      </div>
      <ReceiptPlayground />
    </section>
  )
}
