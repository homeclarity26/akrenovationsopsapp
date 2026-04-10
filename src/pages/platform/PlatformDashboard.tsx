import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Users } from 'lucide-react'
import { MetricCard } from '@/components/ui/Card'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export function PlatformDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: companyCount = 0 } = useQuery({
    queryKey: ['platform-company-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('companies')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    },
  })

  const { data: userCount = 0 } = useQuery({
    queryKey: ['platform-user-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    },
  })

  const { data: projectCount = 0 } = useQuery({
    queryKey: ['platform-project-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'pending'])
      return count ?? 0
    },
  })

  const { data: aiUsageCount = 0 } = useQuery({
    queryKey: ['platform-ai-usage'],
    queryFn: async () => {
      const { count } = await supabase
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
      return count ?? 0
    },
  })

  const { data: recentSignups = [] } = useQuery({
    queryKey: ['platform-recent-signups'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })

  const { data: recentCompanies = [] } = useQuery({
    queryKey: ['platform-recent-companies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, industry, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(' ')[0] ?? 'Admin'}.`}
        subtitle="Platform overview — all companies and users"
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Companies" value={companyCount} subtitle="Total registered" />
        <MetricCard label="Users" value={userCount} subtitle="Across all companies" />
        <MetricCard label="Active Projects" value={projectCount} subtitle="In progress" />
        <MetricCard label="AI Requests" value={aiUsageCount} subtitle="Total logged" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/platform/companies')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[var(--border-light)] hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-[var(--navy)]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text)]">Companies</p>
            <p className="text-[11px] text-[var(--text-secondary)]">Manage all</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/platform/users')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[var(--border-light)] hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--rust-subtle)] flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-[var(--rust)]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text)]">Users</p>
            <p className="text-[11px] text-[var(--text-secondary)]">All accounts</p>
          </div>
        </button>
      </div>

      {/* Recent companies */}
      <div>
        <SectionHeader
          title="Recent Companies"
          action={
            <button onClick={() => navigate('/platform/companies')} className="text-xs text-[var(--rust)] font-medium hover:opacity-80 transition-opacity">
              See all
            </button>
          }
        />
        <Card padding="none">
          {recentCompanies.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No companies registered yet.</p>
            </div>
          ) : (
            recentCompanies.map(company => (
              <div
                key={company.id}
                className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
                onClick={() => navigate(`/platform/companies/${company.id}`)}
              >
                <div className="w-9 h-9 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-[var(--navy)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{company.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{company.industry ?? 'No industry'}</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                  {new Date(company.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Recent signups */}
      <div>
        <SectionHeader
          title="Recent Signups"
          action={
            <button onClick={() => navigate('/platform/users')} className="text-xs text-[var(--rust)] font-medium hover:opacity-80 transition-opacity">
              See all
            </button>
          }
        />
        <Card padding="none">
          {recentSignups.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No users signed up yet.</p>
            </div>
          ) : (
            recentSignups.map(profile => (
              <div
                key={profile.id}
                className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">
                    {(profile.full_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{profile.full_name}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{profile.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    profile.role === 'admin' ? 'bg-[var(--navy)] text-white' :
                    profile.role === 'super_admin' ? 'bg-[var(--rust)] text-white' :
                    profile.role === 'employee' ? 'bg-[var(--cream-light)] text-[var(--navy)]' :
                    'bg-gray-100 text-[var(--text-secondary)]'
                  }`}>
                    {profile.role}
                  </span>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="h-4" />
    </div>
  )
}
