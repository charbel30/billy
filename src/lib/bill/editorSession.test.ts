import { expect, test, vi } from 'vitest'
import { EditorSession } from './editorSession'
import type { WorkingBill } from './types'
const initial: WorkingBill = {
  version: 1,
  status: 'READY',
  people: [{ id: 'a', name: 'A', color: 'red' }],
  lineItems: [
    { id: 'meal', name: 'Meal', qty: 1, unitPrice: 90000, lineTotal: 90000 },
  ],
  meta: {
    merchantName: 'Initial',
    currencyPrimary: 'LBP',
    rate: 90000,
    rateSource: 'manual',
    serviceCharge: 0,
    tax: 0,
    serviceChargeOn: false,
    serviceSplitMode: 'proportional',
  },
}
const renamed = (name: string) => ({
  ...initial,
  meta: { ...initial.meta, merchantName: name },
})
function deferred() {
  let resolve!: (value: { version: number }) => void
  let reject!: (error: Error) => void
  const promise = new Promise<{ version: number }>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test('failure stays failed and a successful retry acknowledges the draft', async () => {
  const io = {
    persist: () => true,
    clear: vi.fn(),
    save: vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ version: 2 }),
  }
  const session = new EditorSession(initial, io)
  session.edit(renamed('New'))
  expect(session.state).toBe('unsaved')
  expect(await session.flush()).toBe(false)
  expect(session.state).toBe('failed')
  expect(io.clear).not.toHaveBeenCalled()
  expect(await session.flush()).toBe(true)
  expect(session.state).toBe('saved')
})

test('overlapping flushes serialize; an older acknowledgement preserves the newer recovery copy', async () => {
  const first = deferred(),
    second = deferred()
  let recovery: WorkingBill | null = null
  const save = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  const session = new EditorSession(initial, {
    save,
    persist: (draft) => {
      recovery = draft
      return true
    },
    clear: (draft) => {
      if (JSON.stringify(recovery) === JSON.stringify(draft)) recovery = null
    },
  })
  session.edit(renamed('First'))
  const flushing = session.flush()
  await Promise.resolve()
  session.edit(renamed('Second'))
  expect(session.flush()).toBe(flushing)
  first.resolve({ version: 2 })
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(recovery).toMatchObject({
    meta: { merchantName: 'Second' },
    version: 2,
  })
  expect(save.mock.calls[1][1]).toBe(2)
  second.resolve({ version: 3 })
  expect(await flushing).toBe(true)
  expect(recovery).toBeNull()
  expect(session.working.meta.merchantName).toBe('Second')
})

test('a server push for the pending save cannot replace a newer local edit', async () => {
  const request = deferred()
  const save = vi
    .fn()
    .mockReturnValueOnce(request.promise)
    .mockRejectedValueOnce(new Error('offline'))
  const session = new EditorSession(initial, {
    save,
    persist: () => true,
    clear: () => {},
  })
  session.edit(renamed('First'))
  const flushing = session.flush()
  await Promise.resolve()
  session.edit(renamed('Second'))
  session.receive({ ...renamed('First'), version: 2 })
  expect(session.working.meta.merchantName).toBe('Second')
  request.resolve({ version: 2 })
  await flushing
  expect(session.working.meta.merchantName).toBe('Second')
  expect(session.state).toBe('failed')
})

test('stale recovery needs an explicit decision before replacing newer server data', async () => {
  const save = vi.fn().mockResolvedValue({ version: 4 })
  const session = new EditorSession(
    { ...initial, version: 3 },
    { save, persist: () => true, clear: () => {} },
  )
  session.restore(renamed('Recovered'))
  expect(session.editedElsewhere).toBe(true)
  expect(await session.flush()).toBe(false)
  expect(save).not.toHaveBeenCalled()
  session.keepLocal()
  expect(await session.flush()).toBe(true)
  expect(save.mock.calls[0][1]).toBe(3)
})

test('adopting the server is explicit and finalized receipts cannot be edited', async () => {
  const save = vi.fn()
  const session = new EditorSession(initial, {
    save,
    persist: () => true,
    clear: () => {},
  })
  session.edit(renamed('Draft'))
  session.receive({ ...renamed('Final'), status: 'FINALIZED', version: 2 })
  expect(await session.flush()).toBe(false)
  session.useServer()
  session.edit(renamed('Nope'))
  expect(session.working.meta.merchantName).toBe('Final')
  expect(save).not.toHaveBeenCalled()
})
