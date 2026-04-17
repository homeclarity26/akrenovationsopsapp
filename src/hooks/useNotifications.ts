// useNotifications — bell-feed for the authenticated user.
//
// Subscribes to realtime on the `notifications` table (filtered by user_id).
// When the dispatcher inserts a new row we:
//   1. Invalidate React Query so the popover + unread count refresh.
//   2. Optionally play a short chime, gated by notification_preferences.sound.
//
// Also exposes:
//   markRead(id)         — optimistic single-row read-marker
//   markAllRead()        — bulk read-marker
//   unreadCount          — derived count for the bell badge

import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface NotificationRow {
  id: string
  user_id: string
  company_id: string
  kind: string
  title: string
  body: string | null
  link_url: string | null
  read_at: string | null
  source_reminder_id: string | null
  created_at: string
}

export interface NotificationPreferences {
  email?: boolean
  sms?: boolean
  in_app?: boolean
  sound?: boolean
}

function playChime() {
  // Short, quiet WebAudio blip. Avoids shipping an audio file. Any failure
  // (autoplay-blocked, unsupported) is swallowed.
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.value = 0.0001
    osc.connect(gain).connect(ctx.destination)
    const t = ctx.currentTime
    osc.start(t)
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    osc.stop(t + 0.26)
  } catch {
    // ignore
  }
}

export function useNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()
  // Track the newest created_at we've rendered so realtime inserts can decide
  // whether to chime. Guards against re-chiming on cache refetches.
  const lastSeenRef = useRef<string | null>(null)

  // Notifications list. Never throws from queryFn — a 4xx/5xx from Supabase
  // is logged and an empty list is returned so the consumer can render a
  // harmless empty bell instead of propagating the error up to the app's
  // top-level Sentry ErrorBoundary.
  const query = useQuery<NotificationRow[]>({
    queryKey: ['notifications', user?.id ?? 'anon'],
    queryFn: async () => {
      if (!user) return []
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) {
          console.warn('[useNotifications] select failed:', error.message)
          return []
        }
        const rows = (data ?? []) as NotificationRow[]
        if (rows[0]) lastSeenRef.current = rows[0].created_at
        return rows
      } catch (e) {
        console.warn('[useNotifications] select threw:', e)
        return []
      }
    },
    enabled: !!user,
    retry: 0,
  })

  // Fetch prefs separately so we can gate the chime without coupling.
  const prefsQuery = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences', user?.id ?? 'anon'],
    queryFn: async () => {
      if (!user) return {}
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', user.id)
          .maybeSingle()
        return (data?.notification_preferences as NotificationPreferences) ?? {}
      } catch (e) {
        console.warn('[useNotifications] prefs fetch threw:', e)
        return {}
      }
    },
    enabled: !!user,
    retry: 0,
  })

  useEffect(() => {
    if (!user?.id) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel(`notifications:${user.id}`)
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: { eventType?: string; new?: NotificationRow }) => {
          try {
            if (payload?.eventType === 'INSERT' && payload.new) {
              const row = payload.new
              if (!lastSeenRef.current || row.created_at > lastSeenRef.current) {
                lastSeenRef.current = row.created_at
                if (prefsQuery.data?.sound !== false) playChime()
              }
            }
            qc.invalidateQueries({ queryKey: ['notifications', user.id] })
          } catch (e) {
            console.warn('[useNotifications] realtime callback threw:', e)
          }
        },
      )
      channel.subscribe()
    } catch (e) {
      console.warn('[useNotifications] channel setup threw:', e)
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        // ignore
      }
    }
  }, [user?.id, qc, prefsQuery.data?.sound])

  const markRead = useCallback(
    async (id: string) => {
      if (!user?.id) return
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
      qc.invalidateQueries({ queryKey: ['notifications', user.id] })
    },
    [user?.id, qc],
  )

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    qc.invalidateQueries({ queryKey: ['notifications', user.id] })
  }, [user?.id, qc])

  const unreadCount = (query.data ?? []).filter((n) => !n.read_at).length

  return {
    notifications: query.data ?? [],
    unreadCount,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
    preferences: prefsQuery.data ?? {},
  }
}

export function useUpdateNotificationPreferences() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prefs: NotificationPreferences & { timezone?: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated')
      const patch: Record<string, unknown> = {}
      const { timezone, ...channelPrefs } = prefs
      if (Object.keys(channelPrefs).length > 0) {
        patch.notification_preferences = channelPrefs
      }
      if (timezone !== undefined) patch.timezone = timezone
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      if (user?.id) {
        qc.invalidateQueries({ queryKey: ['notification-preferences', user.id] })
      }
    },
  })
}
