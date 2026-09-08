import {
  ErrorComponent,
  Link,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { captureFrontendError } from '~/lib/observability'
import { BrandSymbol } from '~/components/shared/Brand'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useLocation({
    select: (location) => location.pathname === '/',
  })

  useEffect(() => {
    captureFrontendError(error)
  }, [error])

  console.error(error)

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <span className="brand-tile grid size-20 place-items-center rounded-[26px]"><BrandSymbol className="size-16" /></span>
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">We couldn’t load this page.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Check your connection and try again, or return to Spolio.</p>
      </div>
      {import.meta.env.DEV && <details className="max-w-full"><summary>Error details</summary><ErrorComponent error={error} /></details>}
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant="outline"
          onClick={() => {
            router.invalidate()
          }}
        >
          Try again
        </Button>
        {!isRoot && <Button render={<Link to="/" />}>Back to Spolio</Button>}
      </div>
    </div>
  )
}
