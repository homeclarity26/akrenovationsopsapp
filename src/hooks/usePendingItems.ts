/**
 * Hook: "Needs attention" items for the Agent Overlay.
 *
 * Queries three tables:
 *   1. `inventory_alerts`         — open alerts
 *   2. `ai_project_suggestions`   — pending suggestions
 *   3. `messages`                 — unread messages
 *
 * Returns combined count + arrays for each section.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface PendingAlert {
  id: string
  item_name: string
  alert_type: string
  message: string
  created_at: string
}

export interface PendingSuggestion {
  id: string
  summary: string
  suggestion_type: string
  created_at: string
}

export interface UnreadMessage {
  id: string
  content: string
  sender_name: string
  created_at: string
}

export interface PendingItems {
  alerts: PendingAlert[]
  suggestions: PendingSuggestion[]
  unreadMessages: UnreadMessage[]
  totalCount: number
  isLoading: boolean
}

export function usePendingItems(): PendingItems {
  const { user } = useAuth()
  const companyId = user?.company_id

  const alertsQuery = useQuery<PendingAlert[]>({
    queryKey: ['agent_pending_alerts', companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select('id, item_name, alert_type, message, created_at')
        .eq('company_id', companyId as string)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as PendingAlert[]
    },
  })

  const suggestionsQuery = useQuery<PendingSuggestion[]>({
    queryKey: ['agent_pending_suggestions', companyId],
    enabled: !!companyId && (user?.role === 'admin' || user?.role === 'super_admin'),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_project_suggestions')
        .select('id, summary, suggestion_type, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as PendingSuggestion[]
    },
  })

  const messagesQuery = useQuery<UnreadMessage[]>({
    queryKey: ['agent_unread_messages', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // Actual columns on public.messages: message (not content), is_read
      // (not read), sender_id (no sender_name — would need a profiles join).
      const { data, error } = await supabase
        .from('messages')
        .select('id, message, sender_id, created_at')
        .eq('recipient_id', user!.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) {
        console.warn('[usePendingItems] messages query failed:', error.message)
        return []
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        content: row.message ?? '',
        // sender_name placeholder — could be enriched with a profiles lookup
        // in a follow-up if the overlay needs a real name.
        sender_name: row.sender_id ?? '',
        created_at: row.created_at,
      })) as UnreadMessage[]
    },
  })

  const alerts = alertsQuery.data ?? []
  const suggestions = suggestionsQuery.data ?? []
  const unreadMessages = messagesQuery.data ?? []

  return {
    alerts,
    suggestions,
    unreadMessages,
    totalCount: alerts.length + suggestions.length + unreadMessages.length,
    isLoading: alertsQuery.isLoading || suggestionsQuery.isLoading || messagesQuery.isLoading,
  }
}
