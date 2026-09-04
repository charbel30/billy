import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '~/components/features/landing/LandingPage'
import { landingSeo } from '~/components/features/landing/content'
import { seo } from '~/lib/seo'

export const Route = createFileRoute('/')({
  head: () => ({ meta: seo(landingSeo) }),
  component: LandingPage,

})
