import type { ErrorEvent } from '@sentry/react'

type SentryBrowser = typeof import('./sentry')

type SentryMetric = {
  name: string
  value: number
  type: 'counter' | 'gauge' | 'distribution'
  unit?: string
  attributes?: Record<string, unknown>
}

export type FunnelMilestone =
  | 'landing'
  | 'scan_started'
  | 'extraction_ok'
  | 'extraction_failed'
  | 'published'
  | 'guest_joined'

const funnelMetricName = 'spolio.funnel'
const funnelMilestones = new Set<FunnelMilestone>([
  'landing',
  'scan_started',
  'extraction_ok',
  'extraction_failed',
  'published',
  'guest_joined',
])
const trackedMilestones = new Set<FunnelMilestone>()
const pendingExtractions = new Set<string>()

let observabilityEnabled = false
let sentryPromise: Promise<SentryBrowser | null> | null = null

/** Browser-only observability; without a DSN this deliberately sends nothing. */
export function initObservability(): void {
  if (typeof window === 'undefined' || sentryPromise) return

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return

  observabilityEnabled = true
  sentryPromise = import('./sentry')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: (defaults) =>
          defaults.filter(
            ({ name }) =>
              ![
                'Breadcrumbs',
                'BrowserSession',
                'ConversationId',
                'HttpContext',
              ].includes(name),
          ),
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        enableLogs: false,
        enableMetrics: true,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: { request: false, response: false },
          httpBodies: [],
          urlQueryParams: false,
          graphQL: { document: false, variables: false },
          genAI: { inputs: false, outputs: false },
          databaseQueryData: false,
          stackFrameVariables: false,
          frameContextLines: 0,
        },
        beforeSend: scrubErrorEvent,
        beforeSendMetric: allowFunnelMetric,
      })
      return Sentry
    })
    .catch(() => null)
}

/** Capture a handled client error without attaching mutation variables/state. */
export function captureFrontendError(error: unknown): void {
  if (!observabilityEnabled) return
  void sentryPromise?.then((Sentry) => Sentry?.captureException(error))
}

/** Count each milestone once per page load. No bill, device or person id is sent. */
export function trackFunnelMilestone(milestone: FunnelMilestone): void {
  if (!observabilityEnabled || trackedMilestones.has(milestone)) return
  trackedMilestones.add(milestone)
  void sentryPromise?.then((Sentry) =>
    Sentry?.metrics.count(funnelMetricName, 1, { attributes: { milestone } }),
  )
}

/** Mark an extraction so a later live-query update can record its outcome. */
export function markExtractionPending(billId: string): void {
  if (observabilityEnabled) pendingExtractions.add(billId)
}

/** Record an outcome only when this tab initiated that extraction. */
export function trackExtractionOutcome(
  billId: string,
  outcome: 'ok' | 'failed',
): void {
  if (!pendingExtractions.delete(billId)) return
  trackFunnelMilestone(outcome === 'ok' ? 'extraction_ok' : 'extraction_failed')
}

function scrubErrorEvent(event: ErrorEvent): ErrorEvent {
  // Free-form messages can contain merchant/item/person names. Stack frame
  // locations and exception types remain useful after the values are redacted.
  event.message = event.message ? '[redacted client error]' : event.message
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = '[redacted client error]'
  }

  delete event.user
  delete event.request
  delete event.breadcrumbs
  delete event.contexts
  delete event.extra
  delete event.tags
  delete event.logentry
  delete event.transaction

  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars
      delete frame.context_line
      delete frame.pre_context
      delete frame.post_context
    }
  }
  return event
}

function allowFunnelMetric(metric: SentryMetric): SentryMetric | null {
  const milestone = metric.attributes?.milestone
  if (
    metric.name !== funnelMetricName ||
    typeof milestone !== 'string' ||
    !funnelMilestones.has(milestone as FunnelMilestone)
  ) {
    return null
  }

  // Discard SDK/scope-enriched attributes and allow only the event name.
  return { ...metric, attributes: { milestone } }
}
