import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ActivityActorType = 'user' | 'ai' | 'system'

export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'commented'
  | 'flagged'
  | 'completed'
  | 'ai_suggestion'
  | 'ai_action'

export interface ProjectActivityRow {
  id: string
  project_id: string
  actor_id: string | null
  actor_type: ActivityActorType
  activity_type: ActivityType
  entity_table: string
  entity_id: string | null
  summary: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface Options {
  /** Maximum number of rows to fetch. Defaults to 50. */
  limit?: number
}

/**
 * Loads the most recent activity rows for a project and keeps the cache
 * live via realtime. The hook is safe to call with a falsy projectId
 * (it just doesn't fetch / subscribe).
 *
 * Under the hood:
 *   • `useQuery(['project_activity', projectId])` fetches the latest N rows
 *     joined to the actor profile.
 *   • A dedicated realtime channel listens for INSERTs on project_activity
 *     filtered by project_id and invalidates the query on every event.
 *
 * The channel is separate from `useProjectRealtime`'s — we don't want to
 * refactor the existing hook, and a single extra channel per detail page
 * is cheap.
 */
export function useProjectActivity(
  projectId: string | undefined | null,
  options: Options = {},
) {
  const limit = options.limit ?? 50
  const queryClient = useQueryClient()

  const query = useQuery<ProjectActivityRow[]>({
    queryKey: ['project_activity', projectId, limit],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_activity')
        .select(
          'id, project_id, actor_id, actor_type, activity_type, entity_table, entity_id, summary, metadata, created_at, actor:profiles!project_activity_actor_id_fkey(id, full_name, avatar_url)',
        )
        .eq('project_id', projectId as string)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as ProjectActivityRow[]
    },
  })

  useEffect(() => {
    if (!projectId) return

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel(`project-activity:${projectId}`)
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT', schema: 'public', table: 'project_activity',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['project_activity', projectId] })
        },
      )
      channel.subscribe()
    } catch (err) {
      console.warn('[useProjectActivity] subscribe failed; live updates disabled', err)
    }

    return () => {
      try { if (channel) supabase.removeChannel(channel) } catch { /* noop */ }
    }
  }, [projectId, queryClient])

  return query
}
