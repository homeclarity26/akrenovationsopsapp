// usePickableProjects — one source of truth for the "pick a project" dropdown
// that shows up on every field-mode page (Notes, Receipts, Photos, Shopping,
// TimeClock, ToolRequest, FlagChangeOrder, ...).
//
// Past bug pattern (2026-04-19): each page ran its own .from('projects')
// query with different filters. Some filtered to status='active' only,
// missing the common status='pending' state. Some didn't wait for auth to
// hydrate, returning empty on the first render and then never re-running.
// The dropdown rendered empty with "You're not assigned to any active
// projects" even for admins who own all the projects.
//
// This hook:
//   - waits for auth (enabled on user.id)
//   - includes BOTH 'active' and 'pending' by default (caller can override)
//   - relies on RLS to scope rows correctly: admins/super_admins see their
//     whole company, employees see only projects they're assigned to
//   - is cached per user so multiple pages share the same request

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface PickableProject {
  id: string
  title: string
  client_name: string | null
  status: string
}

interface Options {
  /** Default ['active', 'pending']. Pass your own if you want a narrower list. */
  statuses?: string[]
}

export function usePickableProjects(opts: Options = {}) {
  const { user } = useAuth()
  const statuses = opts.statuses ?? ['active', 'pending']

  return useQuery<PickableProject[]>({
    queryKey: ['pickable-projects', user?.id, statuses.join(',')],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, client_name, status')
        .in('status', statuses)
        .order('title')
      if (error) throw error
      return (data ?? []) as PickableProject[]
    },
  })
}
