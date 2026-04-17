// SafeBoundary — a minimal error boundary for wrapping non-critical UI
// widgets (like the NotificationBell) so that a crash inside them cannot
// take down the whole layout / app. Renders `fallback` (default: null) on
// error, logs to console, and reports to Sentry if available.
//
// This is INTENTIONALLY narrower than the app's main Sentry.ErrorBoundary
// in App.tsx: that one wraps all of <AppRoutes> and renders the full
// "Something went wrong" splash. This one is quiet by default so a broken
// widget is invisible, not catastrophic.

import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
  children: ReactNode
  /** What to show instead of `children` when an error is caught. Default: render nothing. */
  fallback?: ReactNode
  /** A label included in Sentry/console so we can identify which boundary fired. */
  label?: string
}

interface State {
  hasError: boolean
}

export class SafeBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? 'SafeBoundary'
    console.error(`[SafeBoundary:${label}]`, error, info)
    try {
      Sentry.captureException(error, {
        tags: { safe_boundary: label },
        extra: { componentStack: info.componentStack },
      })
    } catch {
      // Sentry may not be initialized yet — swallow.
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}
