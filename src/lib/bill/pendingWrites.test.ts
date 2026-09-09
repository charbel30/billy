import { expect, test } from 'vitest'
import { PendingWrites } from './pendingWrites'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('finalization waits for every overlapping edit, even when the latest finishes first', async () => {
  const writes = new PendingWrites()
  const first = deferred()
  const second = deferred()
  writes.track(first.promise)
  writes.track(second.promise)
  let finalized = false
  const finalization = writes.wait().then((ok) => { finalized = ok })
  second.resolve()
  await second.promise
  expect(finalized).toBe(false)
  first.resolve()
  await finalization
  expect(finalized).toBe(true)
})

test('a failed pending claim prevents finalization and does not poison a retry', async () => {
  const writes = new PendingWrites()
  const claim = deferred()
  writes.track(claim.promise)
  const finalization = writes.wait()
  claim.reject(new Error('Disconnected'))
  expect(await finalization).toBe(false)
  await writes.track(Promise.resolve())
  expect(await writes.wait()).toBe(true)
})
