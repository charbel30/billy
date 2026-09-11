import { useEffect, useLayoutEffect, useState } from 'react'

// Layout effect on the client so a viewport-gated surface (the dock) mounts
// before the first paint; plain effect on the server render path.
const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect

function readMatch(query: string): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(query).matches
}

/**
 * Tracks a CSS media query. SSR assumes no match. On the client the first
 * render reads `matchMedia` so a mobile dock is in the first committed frame
 * (needed for view-transition snapshots).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => readMatch(query))

  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
