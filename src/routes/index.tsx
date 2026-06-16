import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RiCameraLine } from '@remixicon/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-black">Split a receipt</h1>
        <p className="text-muted-foreground text-sm">
          Photograph a bill. See it in LBP &amp; USD at the venue's rate, then
          split item-by-item.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan a receipt</CardTitle>
          <CardDescription>
            Use your camera — we read the items for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate({ to: '/scan' })}
          >
            <RiCameraLine /> Scan
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
