import { Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
      <div className="text-sm text-muted-foreground">
        {children || <p>The page you are looking for does not exist.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Button render={<Link to="/" />}>Start over</Button>
      </div>
    </div>
  )
}
