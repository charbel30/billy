// Keep the lazy SDK boundary narrow so unused integrations and React helpers
// can be tree-shaken instead of retaining the entire package namespace.
export { init, captureException, metrics } from '@sentry/react'
