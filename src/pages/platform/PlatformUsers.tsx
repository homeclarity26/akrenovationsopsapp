import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

type RoleFilter = 'all' | 'admin' | 'employee' | 'client' | 'platform_owner'

export function PlatformUsers() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['platform-all-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, company_id, created_at')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['platform-companies-lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
      return data ?? []
    },
  })

  const companyMap = new Map(companies.map(c => [c.id, c.name]))

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const matchesName = (u.full_name ?? '').toLowerCase().includes(q)
      const matchesEmail = (u.email ?? '').toLowerCase().includes(q)
      const matchesCompany = u.company_id ? (companyMap.get(u.company_id) ?? '').toLowerCase().includes(q) : false
      if (!matchesName && !matchesEmail && !matchesCompany) return false
    }
    return true
  })

  const ROLE_TABS: { value: RoleFilter; label: string }[] = [
    { value: 'all', label: `All (${users.length})` },
    { value: 'admin', label: `Admins (${users.filter(u => u.role === 'admin').length})` },
    { value: 'employee', label: `Employees (${users.filter(u => u.role === 'employee').length})` },
    { value: 'client', label: `Clients (${users.filter(u => u.role === 'client').length})` },
    { value: 'platform_owner', label: `Platform (${users.filter(u => u.role === 'platform_owner').length})` },
  ]

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Users"
        subtitle={`${users.length} user${users.length === 1 ? '' : 's'} across all companies`}
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-[var(--border)] rounded-[14px] text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors"
        />
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {ROLE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setRoleFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              roleFilter === tab.value
                ? 'bg-[var(--navy)] text-white'
                : 'bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users list */}
      <Card padding="none">
        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Loading users...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {search || roleFilter !== 'all' ? 'No users match your filters.' : 'No users found.'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header (desktop) */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_200px_150px_100px_80px_100px] gap-4 px-4 py-2.5 border-b border-[var(--border-light)] bg-gray-50/50 rounded-t-xl">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Name</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Email</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Company</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Role</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Status</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Joined</p>
            </div>
            {filtered.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 lg:grid lg:grid-cols-[1fr_200px_150px_100px_80px_100px] lg:gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-semibold">{(u.full_name ?? '?').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{u.full_name}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate lg:hidden">{u.email}</p>
                    {u.company_id && (
                      <p className="text-[10px] text-[var(--text-tertiary)] lg:hidden">{companyMap.get(u.company_id) ?? 'Unknown'}</p>
                    )}
                  </div>
                </div>
                <p className="hidden lg:block text-sm text-[var(--text-secondary)] truncate">{u.email}</p>
                <p className="hidden lg:block text-sm text-[var(--text-secondary)] truncate">
                  {u.company_id ? (companyMap.get(u.company_id) ?? '--') : '--'}
                </p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${
                  u.role === 'admin' ? 'bg-[var(--navy)] text-white' :
                  u.role === 'platform_owner' ? 'bg-[var(--rust)] text-white' :
                  u.role === 'employee' ? 'bg-[var(--cream-light)] text-[var(--navy)]' :
                  'bg-gray-100 text-[var(--text-secondary)]'
                }`}>
                  {u.role}
                </span>
                <span className={`hidden lg:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${
                  u.is_active ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-gray-100 text-[var(--text-tertiary)]'
                }`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
                <p className="hidden lg:block text-xs text-[var(--text-tertiary)]">
                  {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </>
        )}
      </Card>

      <div className="h-4" />
    </div>
  )
}
