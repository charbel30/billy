import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RiCameraLine, RiPencilLine } from '@remixicon/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { useCreateBill } from '~/queries'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const createBill = useCreateBill()

  async function startManual() {
    const billId = await createBill.mutateAsync({})
    navigate({ to: '/review/$billId', params: { billId } })
  }

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-black">Split a receipt</h1>
        <p className="text-muted-foreground text-sm">
          Photograph a bill or type it in. See it in LBP &amp; USD at the venue's
          rate, then split item-by-item.
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

      <Card>
        <CardHeader>
          <CardTitle>Enter manually</CardTitle>
          <CardDescription>
            No photo? Type the bill in. Works offline at the table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={startManual}
            disabled={createBill.isPending}
          >
            <RiPencilLine /> Enter manually
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
