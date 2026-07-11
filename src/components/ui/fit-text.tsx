import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { cn } from '~/lib/utils'

// Layout effect on the client (measure before paint, no flash), plain effect on
// the server (no useLayoutEffect SSR warning).
const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect

// Scale an element's font down until its single line fits the element width,
// instead of overflowing or truncating. Only shrinks (never grows past the CSS
// size) and re-fits on resize, font load, and whenever `content` or `refitKey`
// changes — pass a refitKey when the element's CSS font-size can change (the
// override set here would otherwise mask the new class size).
export function useFitText(
  ref: RefObject<HTMLElement | null>,
  content: string,
  minFontPx = 12,
  refitKey?: unknown,
) {
  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      // Clear our override first so we always re-measure against the
      // responsive CSS size (the per-breakpoint max), never a stale shrink.
      el.style.fontSize = ''
      const base = Number.parseFloat(getComputedStyle(el).fontSize)
      if (!base) return
      if (el.scrollWidth - el.clientWidth > 1) {
        const fitted = Math.max(minFontPx, base * (el.clientWidth / el.scrollWidth))
        el.style.fontSize = `${fitted}px`
      }
    }

    fit()
    document.fonts?.ready.then(fit)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [ref, content, minFontPx, refitKey])
}

// Single-line text that scales its font down to fit the container width instead
// of truncating. Needs a bounded width to fit against: by default it's a
// full-width block; add `text-ellipsis` to truncate whatever still overflows at
// `minFontPx`.
export function FitText({
  children,
  className,
  minFontPx = 12,
  refitKey,
}: {
  children: string
  className?: string
  minFontPx?: number
  refitKey?: unknown
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useFitText(ref, children, minFontPx, refitKey)

  return (
    <span
      ref={ref}
      className={cn('block w-full overflow-hidden whitespace-nowrap', className)}
    >
      {children}
    </span>
  )
}
