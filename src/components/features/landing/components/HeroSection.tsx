import { Link, useNavigate } from '@tanstack/react-router'
import { RiArrowRightLine, RiCameraLine, RiLoader4Line } from '@remixicon/react'
import { useCreateDemoBill } from '~/api'
import { getDeviceId, rememberHostToken } from '~/lib/session'
import { heroCopy } from '../content'
import { ReceiptPlayground } from './ReceiptPlayground'

export function HeroSection() {
  const navigate = useNavigate()
  const createDemoBill = useCreateDemoBill()
  const isPending = createDemoBill.isPending

  async function trySampleBill() {
    if (isPending) return
    try {
      const { billId, hostToken } = await createDemoBill.mutateAsync({
        deviceId: getDeviceId(),
      })
      rememberHostToken(billId, hostToken)
      await navigate({ to: '/review/$billId', params: { billId } })
    } catch {
      // Global MutationCache.onError toasts every mutation error.
    }
  }

  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-pitch">
        <p className="landing-eyebrow landing-enter">{heroCopy.badge}</p>
        <h1 id="landing-title" className="landing-title landing-enter">
          {heroCopy.headline[0]}<br />
          <span>{heroCopy.headline[1]}</span>
        </h1>
        <p className="landing-description landing-enter">{heroCopy.subhead}</p>
        <div className="landing-actions landing-enter">
          <Link to="/scan" className="landing-scan">
            <RiCameraLine size={21} aria-hidden="true" />
            {heroCopy.primaryCta}
            <RiArrowRightLine size={20} aria-hidden="true" />
          </Link>
          <p className="landing-reassurance">No account. No app to download.</p>
          <button
            type="button"
            className="landing-sample"
            disabled={isPending}
            aria-busy={isPending}
            onClick={() => void trySampleBill()}
          >
            {isPending ? 'Opening sample…' : heroCopy.secondaryCta}
            {isPending
              ? <RiLoader4Line size={16} className="animate-spin" aria-hidden="true" />
              : <RiArrowRightLine size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <ReceiptPlayground />
    </section>
  )
}
