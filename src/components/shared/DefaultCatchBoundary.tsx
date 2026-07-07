import {
  ErrorComponent,
  Link,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useLocation({
    select: (location) => location.pathname === '/',
  })

  console.error(error)

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant="outline"
          onClick={() => {
            router.invalidate()
          }}
        >
          Try again
        </Button>
        {isRoot ? (
          <Button render={<Link to="/" />}>Home</Button>
        ) : (
          <Button
            render={<Link to="/" />}
            onClick={(e) => {
              e.preventDefault()
              window.history.back()
            }}
          >
            Go back
          </Button>
        )}
      </div>
    </div>
  )
}
