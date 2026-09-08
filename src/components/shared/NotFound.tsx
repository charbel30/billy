import { Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { BrandSymbol } from '~/components/shared/Brand'

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="brand-tile grid size-20 place-items-center rounded-[26px]"><BrandSymbol className="size-16" /></span>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">We couldn’t find this page.</h1>
      <div className="text-sm text-muted-foreground">
        {children || <p>Check the link, or start a new bill with Spolio.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" variant="outline" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Button size="lg" render={<Link to="/" />}>Back to Spolio</Button>
      </div>
    </div>
  )
}
