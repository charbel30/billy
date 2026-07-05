import { Link } from '@tanstack/react-router'

export function LegalFooter() {
  return (
    <footer className="mt-8 flex items-center justify-center gap-3 pb-4 text-xs text-muted-foreground">
      <Link to="/privacy" className="transition-colors hover:text-foreground">
        Privacy
      </Link>
      <span aria-hidden>·</span>
      <Link to="/terms" className="transition-colors hover:text-foreground">
        Terms
      </Link>
    </footer>
  )
}
