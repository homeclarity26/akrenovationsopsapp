/**
 * Hook: last 5 `project_activity` rows for the current user.
 *
 * Shown in the "Recent" section of the Agent Overlay.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface RecentActivityItem {
  id: string
  summary: string
  activity_type: string
  entity_table: string
  created_at: string
  project_name?: string
}

export function useRecentActivity() {
  const { user } = useAuth()

  return useQuery<RecentActivityItem[]>({
    queryKey: ['agent_recent_activity', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_activity')
        .select('id, summary, activity_type, entity_table, created_at, project:projects!project_activity_project_id_fkey(name)')
        .eq('actor_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) {
        console.warn('[useRecentActivity] query failed:', error.message)
        return []
      }
      // Flatten the joined project name
      return (data ?? []).map((row) => ({
        id: row.id as string,
        summary: row.summary as string,
        activity_type: row.activity_type as string,
        entity_table: row.entity_table as string,
        created_at: row.created_at as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        project_name: (row.project as any)?.name as string | undefined,
      }))
    },
  })
}
