import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import { Loader } from '~/components/Loader'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { Separator } from '~/components/ui/separator'
import { PersonChips } from '~/components/PersonChips'
import { AssignGrid } from '~/components/AssignGrid'
import {
  billQueries,
  useAddPerson,
  useDeletePerson,
  useToggleAssignment,
  useUpdateBillMeta,
} from '~/queries'

export const Route = createFileRoute('/split/$billId')({
  component: Split,
  pendingComponent: () => <Loader />,
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      billQueries.detail(params.billId as Id<'bills'>),
    )
  },
})

function Split() {
  const billId = Route.useParams().billId as Id<'bills'>
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(billQueries.detail(billId))
  const { bill, lineItems, people, assignments } = data

  const addPerson = useAddPerson()
  const deletePerson = useDeletePerson()
  const toggle = useToggleAssignment()
  const updateMeta = useUpdateBillMeta()

  const even = bill.serviceSplitMode === 'even'

  return (
    <div className="mx-auto w-full max-w-md p-4 sm:p-6 space-y-5">
      <h1 className="text-xl font-black">Split</h1>

      <div className="space-y-2">
        <Label>People</Label>
        <PersonChips
          people={people}
          onAdd={(name) => addPerson.mutate({ billId, name })}
          onRemove={(id) => deletePerson.mutate({ id })}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Assign items</Label>
        <AssignGrid
          lineItems={lineItems}
          people={people}
          assignments={assignments}
          rate={bill.rate}
          onToggle={(lineItemId, personId) =>
            toggle.mutate({ billId, lineItemId, personId })
          }
        />
      </div>

      <Separator />

      <label className="flex items-center justify-between gap-4">
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Split service &amp; tax evenly</span>
          <span className="block text-xs text-muted-foreground">
            Off = proportional to each person's items (the fair default)
          </span>
        </span>
        <Switch
          checked={even}
          onCheckedChange={(checked) =>
            updateMeta.mutate({
              id: billId,
              serviceSplitMode: checked ? 'even' : 'proportional',
            })
          }
        />
      </label>

      <Button
        size="lg"
        className="w-full"
        disabled={people.length === 0}
        onClick={() => navigate({ to: '/summary/$billId', params: { billId } })}
      >
        See totals
      </Button>
    </div>
  )
}
