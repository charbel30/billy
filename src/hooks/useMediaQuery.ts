import { useEffect, useLayoutEffect, useState } from 'react'

// Layout effect on the client so a viewport-gated surface (the dock) mounts
// before the first paint; plain effect on the server render path.
const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Tracks a CSS media query. SSR and the first client render both assume "no
 * match", so mobile-only surfaces mount in the layout effect that follows.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
