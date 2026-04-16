// Returns the active project for the currently-authenticated client user.
// Clients are linked to a project via projects.client_user_id.
// If the client has multiple projects, we return the most recently updated one.
// Returns null while loading or if no project is found.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface ClientProject {
  id: string
  title: string
  address: string | null
  status: string | null
  client_name: string | null
  client_email: string | null
  estimated_start_date: string | null
  actual_start_date: string | null
  target_completion_date: string | null
  contract_value: number | null
  percent_complete: number | null
  current_phase: string | null
}

export function useClientProject() {
  const { user } = useAuth()

  return useQuery<ClientProject | null>({
    queryKey: ['client-project', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, title, address, status, client_name, client_email, estimated_start_date, actual_start_date, target_completion_date, contract_value, percent_complete, current_phase'
        )
        .eq('client_user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.warn('[useClientProject] fetch error:', error.message)
        return null
      }
      return data as ClientProject | null
    },
  })
}
