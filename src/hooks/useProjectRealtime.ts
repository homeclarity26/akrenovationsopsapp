import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Map of realtime tables → the React Query cache-key prefixes they feed.
// When a postgres_changes event fires for a table, we invalidate every
// matching cache key so useQuery refetches.
//
// Cache keys are intentionally structured as [prefix, projectId, ...rest] so
// the invalidation can match on the prefix + projectId without caring about
// the trailing company_id / filter tail. React Query's invalidateQueries
// does prefix matching by default, so ['project_tasks', id] will match
// ['project_tasks', id, companyId], ['project_tasks', id, 'active'], etc.
const TABLE_TO_QUERY_KEYS: Record<string, string[]> = {
  projects:               ['project'],
  project_phases:         ['project_phases'],
  project_assignments:    ['project_assignments', 'project_assignments_count'],
  tasks:                  ['project_tasks'],
  daily_logs:             ['project_daily_logs', 'daily-logs'],
  change_orders:          ['project_change_orders', 'change-orders-flagged'],
  punch_list_items:       ['project_punch_list'],
  warranty_claims:        ['project_warranty_claims'],
  project_photos:         ['project_photos'],
  project_files:          ['project_files'],
  shopping_list_items:    ['shopping-list', 'project_shopping'],
  messages:               ['messages', 'project_messages'],
  expenses:               ['project_expenses', 'receipts'],
  schedule_events:        ['project_schedule'],
}

/**
 * Subscribes to realtime changes for every project-scoped table and
 * invalidates the matching React Query caches so the UI updates live.
 *
 * Pass a falsy projectId to no-op (e.g. while a route param is still loading).
 *
 * One channel per hook invocation, scoped to the project, with one listener
 * per table. Channels are torn down on unmount or projectId change.
 */
export function useProjectRealtime(projectId: string | undefined | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return

    const channel = supabase.channel(`project:${projectId}`)

    for (const [table, keyPrefixes] of Object.entries(TABLE_TO_QUERY_KEYS)) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          // `projects` row's project_id is its own id, so we can't use the same
          // filter. Special-case it: filter by id instead.
          filter: table === 'projects'
            ? `id=eq.${projectId}`
            : `project_id=eq.${projectId}`,
        },
        () => {
          for (const prefix of keyPrefixes) {
            // Invalidate both the unscoped key (e.g. ['messages']) and the
            // project-scoped key (['project_messages', projectId]). We don't
            // know at runtime which shape the consumer used; invalidating a
            // prefix of length 1 or 2 is cheap and matches either.
            queryClient.invalidateQueries({ queryKey: [prefix] })
            queryClient.invalidateQueries({ queryKey: [prefix, projectId] })
          }
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])
}
