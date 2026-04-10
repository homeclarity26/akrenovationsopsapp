// Sentry initialization — imported asynchronously from main.tsx so it never
// blocks first paint. The @sentry/react package is still eagerly available in
// App.tsx for the ErrorBoundary component (which is fine — the ErrorBoundary
// works even if init() hasn't resolved yet; it just won't report until init
// completes).

import * as Sentry from '@sentry/react'

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
})
