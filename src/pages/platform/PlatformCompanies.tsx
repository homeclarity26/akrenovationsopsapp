import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

export function PlatformCompanies() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['platform-companies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, industry, city, state, owner_name, created_at')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  // Fetch user counts per company
  const { data: userCounts = {} } = useQuery({
    queryKey: ['platform-company-user-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('company_id')
        .not('company_id', 'is', null)
      if (!data) return {}
      const counts: Record<string, number> = {}
      for (const row of data) {
        if (row.company_id) {
          counts[row.company_id] = (counts[row.company_id] ?? 0) + 1
        }
      }
      return counts
    },
  })

  const filtered = companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.owner_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} registered compan${companies.length === 1 ? 'y' : 'ies'}`}
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-[var(--border)] rounded-[14px] text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors"
        />
      </div>

      {/* Companies list */}
      <Card padding="none">
        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Loading companies...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {search ? 'No companies match your search.' : 'No companies registered yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header (desktop) */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_120px_120px_100px_100px] gap-4 px-4 py-2.5 border-b border-[var(--border-light)] bg-gray-50/50 rounded-t-xl">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Company</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Owner</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Location</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Users</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Created</p>
            </div>
            {filtered.map(company => (
              <div
                key={company.id}
                className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors lg:grid lg:grid-cols-[1fr_120px_120px_100px_100px] lg:gap-4"
                onClick={() => navigate(`/platform/companies/${company.id}`)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 lg:min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-[var(--navy)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{company.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] lg:hidden">{company.owner_name ?? 'No owner'}</p>
                  </div>
                </div>
                <p className="hidden lg:block text-sm text-[var(--text-secondary)] truncate">{company.owner_name ?? '--'}</p>
                <p className="hidden lg:block text-sm text-[var(--text-secondary)] truncate">
                  {[company.city, company.state].filter(Boolean).join(', ') || '--'}
                </p>
                <p className="hidden lg:block text-sm text-[var(--text)] font-mono">
                  {userCounts[company.id] ?? 0}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                  {new Date(company.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  )
}
