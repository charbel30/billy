import { expect, test, vi } from 'vitest'
import { openSplitInvite } from '~/components/features/split/invite'

test('the QR link stays hidden until publishing succeeds', async () => {
  let finish!: () => void
  const published = new Promise<void>((resolve) => { finish = resolve })
  const open = vi.fn()
  const pending = openSplitInvite({ shared: false, publish: () => published, open })
  expect(open).not.toHaveBeenCalled()
  finish()
  await pending
  expect(open).toHaveBeenCalledTimes(1)
})

test('an already shared bill opens immediately without republishing', async () => {
  const publish = vi.fn()
  const open = vi.fn()
  await openSplitInvite({ shared: true, publish, open })
  expect(publish).not.toHaveBeenCalled()
  expect(open).toHaveBeenCalledTimes(1)
})

test('publishing failure never exposes an unusable QR link', async () => {
  const open = vi.fn()
  await expect(openSplitInvite({
    shared: false,
    publish: async () => { throw new Error('offline') },
    open,
  })).rejects.toThrow('offline')
  expect(open).not.toHaveBeenCalled()
})
