// useTracking — Phase E
// Lightweight usage tracking for the improvement engine.
// Fires screen_view on mount, screen_exit on unmount, and exposes trackEvent for click/submit tracking.
// All events write to app_usage_events table (when Supabase is connected).

import { useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export function useTracking(screenName: string) {
  const { user } = useAuth()
  const sessionId = typeof window !== 'undefined'
    ? (() => {
        let sid = sessionStorage.getItem('ak_session_id')
        if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('ak_session_id', sid) }
        return sid
      })()
    : 'server'

  const trackEvent = useCallback(async (
    action: string,
    target: string | null = null,
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return
    try {
      await supabase.from('app_usage_events').insert({
        user_id: user.id,
        user_role: user.role,
        screen: screenName,
        action,
        target,
        session_id: sessionId,
        metadata: metadata ?? null,
      })
    } catch {
      // Tracking failures are silent — never break the UI
    }
  }, [user, screenName, sessionId])

  useEffect(() => {
    const startTime = Date.now()
    trackEvent('screen_view')

    return () => {
      const timeOnScreen = Math.round((Date.now() - startTime) / 1000)
      trackEvent('screen_exit', null, { time_on_screen_seconds: timeOnScreen })
    }
  }, [screenName]) // eslint-disable-line react-hooks/exhaustive-deps

  return { trackEvent }
}
