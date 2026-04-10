import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'

export function PlatformCompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['platform-company', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      return data
    },
    enabled: !!id,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['platform-company-users', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, created_at')
        .eq('company_id', id!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!id,
  })

  const { data: _projectCount = 0 } = useQuery({
    queryKey: ['platform-company-projects', id],
    queryFn: async () => {
      // Projects are linked to companies via the profiles of the admin who created them.
      // For now count all projects — this will refine once projects have company_id.
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    },
    enabled: !!id,
  })

  if (companyLoading) {
    return (
      <div className="p-4 lg:px-8 lg:py-6">
        <p className="text-sm text-[var(--text-tertiary)]">Loading company...</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-4 lg:px-8 lg:py-6 text-center">
        <p className="text-sm text-[var(--text-secondary)] mb-4">Company not found.</p>
        <button onClick={() => navigate('/platform/companies')} className="text-sm text-[var(--rust)] font-medium">
          Back to companies
        </button>
      </div>
    )
  }

  const adminUsers = users.filter(u => u.role === 'admin')
  const employeeUsers = users.filter(u => u.role === 'employee')
  const clientUsers = users.filter(u => u.role === 'client')

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      {/* Back nav */}
      <button
        onClick={() => navigate('/platform/companies')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--navy)] transition-colors"
      >
        <ArrowLeft size={16} />
        Companies
      </button>

      <PageHeader
        title={company.name}
        subtitle={[company.industry, company.city, company.state].filter(Boolean).join(' - ')}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Users" value={users.length} subtitle={`${adminUsers.length} admin, ${employeeUsers.length} employee`} />
        <MetricCard label="Clients" value={clientUsers.length} subtitle="Homeowners" />
        <MetricCard label="Owner" value={company.owner_name ?? '--'} />
        <MetricCard
          label="Created"
          value={new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        />
      </div>

      {/* Company info card */}
      <Card>
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-[var(--text)]">Company Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Industry</p>
              <p className="text-[var(--text)]">{company.industry ?? '--'}</p>
            </div>
            <div>
              <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Location</p>
              <p className="text-[var(--text)]">{[company.city, company.state].filter(Boolean).join(', ') || '--'}</p>
            </div>
            <div>
              <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Owner</p>
              <p className="text-[var(--text)]">{company.owner_name ?? '--'}</p>
            </div>
            <div>
              <p className="text-[var(--text-tertiary)] text-xs mb-0.5">Description</p>
              <p className="text-[var(--text)]">{company.description ?? '--'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Users list */}
      <div>
        <SectionHeader
          title={`Users (${users.length})`}
        />
        <Card padding="none">
          {users.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No users in this company yet.</p>
            </div>
          ) : (
            <>
              {/* Table header (desktop) */}
              <div className="hidden lg:grid lg:grid-cols-[1fr_200px_100px_80px_100px] gap-4 px-4 py-2.5 border-b border-[var(--border-light)] bg-gray-50/50 rounded-t-xl">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Name</p>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Email</p>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Role</p>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Status</p>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">Joined</p>
              </div>
              {users.map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 lg:grid lg:grid-cols-[1fr_200px_100px_80px_100px] lg:gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">{(u.full_name ?? '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)] truncate">{u.full_name}</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate lg:hidden">{u.email}</p>
                    </div>
                  </div>
                  <p className="hidden lg:block text-sm text-[var(--text-secondary)] truncate">{u.email}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${
                    u.role === 'admin' ? 'bg-[var(--navy)] text-white' :
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
      </div>

      <div className="h-4" />
    </div>
  )
}
