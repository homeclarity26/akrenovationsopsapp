import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SuggestionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'failed'
  | 'expired'

export interface ProposedActionInsert {
  table: string
  operation: 'insert'
  values: Record<string, unknown>
}

export interface ProposedActionUpdate {
  table: string
  operation: 'update'
  id: string
  patch: Record<string, unknown>
}

export type ProposedAction = ProposedActionInsert | ProposedActionUpdate

export interface ProjectSuggestionRow {
  id: string
  project_id: string
  suggestion_type: string
  summary: string
  rationale: string | null
  proposed_action: ProposedAction
  status: SuggestionStatus
  source: string
  reviewed_by: string | null
  reviewed_at: string | null
  applied_at: string | null
  error_message: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  reviewer?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

interface Options {
  /** If set, only return rows with this status (e.g. 'pending' for the inbox). */
  statusFilter?: SuggestionStatus
  /** Max rows to fetch. Defaults to 50. */
  limit?: number
}

/**
 * Loads AI suggestions for a project with realtime updates.
 *
 * Mirrors useProjectActivity:
 *   • useQuery(['project_suggestions', projectId, ...opts]) fetches the latest
 *     N rows joined to the reviewer profile.
 *   • A dedicated realtime channel listens for any change on
 *     ai_project_suggestions filtered by project_id and invalidates the
 *     query on every event so Approve/Reject in another tab updates the list.
 *
 * Safe to call with a falsy projectId — it just won't fetch or subscribe.
 */
export function useProjectSuggestions(
  projectId: string | undefined | null,
  options: Options = {},
) {
  const { statusFilter, limit = 50 } = options
  const queryClient = useQueryClient()

  const query = useQuery<ProjectSuggestionRow[]>({
    queryKey: ['project_suggestions', projectId, statusFilter, limit],
    enabled: !!projectId,
    queryFn: async () => {
      let q = supabase
        .from('ai_project_suggestions')
        .select(
          'id, project_id, suggestion_type, summary, rationale, proposed_action, status, source, reviewed_by, reviewed_at, applied_at, error_message, expires_at, created_at, updated_at, reviewer:profiles!ai_project_suggestions_reviewed_by_fkey(id, full_name, avatar_url)',
        )
        .eq('project_id', projectId as string)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (statusFilter) q = q.eq('status', statusFilter)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as ProjectSuggestionRow[]
    },
  })

  useEffect(() => {
    if (!projectId) return

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel(`project-suggestions:${projectId}`)
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*', schema: 'public', table: 'ai_project_suggestions',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['project_suggestions', projectId] })
        },
      )
      channel.subscribe()
    } catch (err) {
      console.warn('[useProjectSuggestions] subscribe failed; live updates disabled', err)
    }

    return () => {
      try { if (channel) supabase.removeChannel(channel) } catch { /* noop */ }
    }
  }, [projectId, queryClient])

  return query
}
