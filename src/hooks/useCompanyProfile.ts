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
  // White-label branding
  brand_logo_url: string | null
  brand_color_primary: string | null
  brand_color_accent: string | null
  brand_color_bg: string | null
  brand_favicon_url: string | null
  brand_tagline: string | null
  powered_by_visible: boolean
  powered_by_text: string | null
}

export function useCompanyProfile() {
  const { user } = useAuth()

  return useQuery<CompanyProfile | null>({
    queryKey: ['company-profile', user?.company_id],
    enabled: !!user?.company_id,
    queryFn: async () => {
      // NOTE: `target_margin` was previously in this select list but that
      // column does not exist on the `companies` table (it lives on
      // `projects`). Requesting it returned a 42703 on every page load and
      // made the whole hook return null — killing white-label branding,
      // company name in headers, etc. Removed until the column is added
      // or the consumers are audited.
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, owner_name, city, state, phone, license_number, brand_logo_url, brand_color_primary, brand_color_accent, brand_color_bg, brand_favicon_url, brand_tagline, powered_by_visible, powered_by_text')
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
