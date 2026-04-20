// Sentry initialization — imported asynchronously from main.tsx so it never
// blocks first paint. The @sentry/react package is still eagerly available in
// App.tsx for the ErrorBoundary component (which is fine — the ErrorBoundary
// works even if init() hasn't resolved yet; it just won't report until init
// completes).

import * as Sentry from '@sentry/react'

// Stale-chunk crashes auto-recover via the window handlers + ErrorBoundary
// fallback in App.tsx (see isStaleChunkError + reloadForStaleChunkOnce).
// The user never sees a broken screen — brief "Updating to the latest
// version…" flash then the new bundle loads. But Sentry's ErrorBoundary
// integration still captures the initial throw, which turns a silent
// recovery into a red alert. Drop those events client-side before they
// leave the browser; still leave a breadcrumb so the frequency can be
// counted post-hoc if it ever gets weird.
const STALE_CHUNK_SIGNATURES = [
  /is not a valid JavaScript MIME type/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \d+ failed/i,
  /error loading dynamically imported module/i,
]

function isStaleChunkMessage(msg: string | undefined | null): boolean {
  if (!msg) return false
  return STALE_CHUNK_SIGNATURES.some((re) => re.test(msg))
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event, hint) {
    const err = hint?.originalException as Error | undefined
    const msg = err?.message ?? (typeof event.message === 'string' ? event.message : '')
    const exceptionMsg = event.exception?.values?.[0]?.value ?? ''
    if (isStaleChunkMessage(msg) || isStaleChunkMessage(exceptionMsg)) {
      Sentry.addBreadcrumb({
        category: 'stale-chunk',
        level: 'info',
        message: `Stale-chunk auto-reload triggered: ${exceptionMsg || msg}`,
      })
      return null
    }
    return event
  },
})
