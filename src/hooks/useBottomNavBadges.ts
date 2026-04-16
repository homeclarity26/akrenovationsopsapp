import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

// Wire into EmployeeLayout bottom nav badges. PR 20 owns layout JSX.

interface BadgeCounts {
  stocktakePending: number
  messagesUnread: number
  tasksOverdue: number
}

/**
 * Returns badge counts for the employee bottom nav.
 *
 * - stocktakePending: open inventory alerts (company-wide)
 * - messagesUnread:   unread messages for the current user
 * - tasksOverdue:     overdue tasks assigned to the current user
 *
 * Polls every 60s. Returns zeros while loading or on error.
 */
export function useBottomNavBadges(): BadgeCounts {
  const { user } = useAuth()

  const { data: stocktakePending = 0 } = useQuery({
    queryKey: ['badge-stocktake-pending', user?.company_id],
    enabled: !!user?.company_id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('inventory_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', user!.company_id!)
        .eq('status', 'open')
      return count ?? 0
    },
  })

  const { data: messagesUnread = 0 } = useQuery({
    queryKey: ['badge-messages-unread', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .eq('read', false)
      return count ?? 0
    },
  })

  const { data: tasksOverdue = 0 } = useQuery({
    queryKey: ['badge-tasks-overdue', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user!.id)
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString())
      return count ?? 0
    },
  })

  return { stocktakePending, messagesUnread, tasksOverdue }
}
