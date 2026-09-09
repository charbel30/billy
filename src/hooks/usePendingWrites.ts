import { useRef, useState } from 'react'
import { PendingWrites } from '~/lib/bill'

export function usePendingWrites() {
  const tracker = useRef(new PendingWrites())
  const [count, setCount] = useState(0)

  async function run<T>(write: () => Promise<T>): Promise<T> {
    setCount((count) => count + 1)
    try {
      return await tracker.current.track(write())
    } finally {
      setCount((count) => count - 1)
    }
  }

  return { run, pending: count > 0, wait: () => tracker.current.wait() }
}
