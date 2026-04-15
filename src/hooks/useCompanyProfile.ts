import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface CompanyProfile {
  id: string
  name: string
  logo_url: string | null
  owner_name: string | null
  city: string | null
  state: string | null
  phone: string | null
  license_number: string | null
  target_margin: number | null
}

export function useCompanyProfile() {
  const { user } = useAuth()

  return useQuery<CompanyProfile | null>({
    queryKey: ['company-profile', user?.company_id],
    enabled: !!user?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, owner_name, city, state, phone, license_number, target_margin')
        .eq('id', user!.company_id!)
        .maybeSingle()
      if (error) {
        console.warn('[useCompanyProfile] fetch error:', error.message)
        return null
      }
      return data as CompanyProfile | null
    },
    staleTime: 5 * 60_000,
  })
}
