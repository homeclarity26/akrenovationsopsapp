// useReminders — list + mutations for the authenticated user's reminders.
//
// Subscribes to realtime postgres_changes on the `reminders` table (filtered
// by user_id) so the list updates live when the dispatcher flips a row from
// 'pending' to 'sent', or when the meta-agent schedules a new one.

import { useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface ReminderRow {
  id: string
  user_id: string
  company_id: string
  title: string
  body: string | null
  remind_at: string
  timezone: string | null
  recurrence: 'daily' | 'weekly' | null
  channels: string[]
  status: 'pending' | 'sent' | 'dismissed' | 'error' | 'snoozed'
  created_by_agent: boolean
  project_id: string | null
  sent_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleReminderInput {
  title: string
  body?: string
  remind_at: string // ISO 8601 UTC
  timezone?: string
  recurrence?: 'daily' | 'weekly' | null
  channels?: Array<'in_app' | 'email' | 'sms'>
  project_id?: string
}

export function useReminders() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery<ReminderRow[]>({
    queryKey: ['reminders', user?.id ?? 'anon'],
    queryFn: async () => {
      if (!user) return []
      try {
        const { data, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .order('remind_at', { ascending: true })
        if (error) {
          console.warn('[useReminders] select failed:', error.message)
          return []
        }
        return (data ?? []) as ReminderRow[]
      } catch (e) {
        console.warn('[useReminders] select threw:', e)
        return []
      }
    },
    enabled: !!user,
    retry: 0,
  })

  // Realtime — mirror useProjectRealtime shape
  useEffect(() => {
    if (!user?.id) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel(`reminders:${user.id}`)
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${user.id}` },
        () => {
          try {
            qc.invalidateQueries({ queryKey: ['reminders', user.id] })
          } catch {
            // ignore
          }
        },
      )
      channel.subscribe()
    } catch (e) {
      console.warn('[useReminders] channel setup threw:', e)
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        // ignore
      }
    }
  }, [user?.id, qc])

  return query
}

export function useScheduleReminder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: ScheduleReminderInput) => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schedule-reminder`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        throw new Error(err.error ?? 'Failed to schedule reminder')
      }
      return resp.json() as Promise<{ ok: boolean; reminder: ReminderRow }>
    },
    onSuccess: () => {
      if (user?.id) qc.invalidateQueries({ queryKey: ['reminders', user.id] })
    },
  })
}

export function useDismissReminder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (reminder_id: string) => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dismiss-reminder`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reminder_id }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        throw new Error(err.error ?? 'Failed to dismiss reminder')
      }
      return resp.json() as Promise<{ ok: boolean }>
    },
    onSuccess: () => {
      if (user?.id) {
        qc.invalidateQueries({ queryKey: ['reminders', user.id] })
        qc.invalidateQueries({ queryKey: ['notifications', user.id] })
      }
    },
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (reminder_id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', reminder_id)
      if (error) throw error
    },
    onSuccess: () => {
      if (user?.id) qc.invalidateQueries({ queryKey: ['reminders', user.id] })
    },
  })
}
