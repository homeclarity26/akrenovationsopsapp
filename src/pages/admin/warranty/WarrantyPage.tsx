import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface WarrantyClaim {
  id: string
  project_id: string
  description: string
  reported_by: string | null
  reported_at: string
  status: string
  resolution: string | null
  resolved_at: string | null
  photos: string[] | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  title: string
  client_name: string
  warranty_expiry: string | null
  warranty_months: number
  actual_completion_date: string | null
}

function daysRemaining(expiryDate: string | null): number {
  if (!expiryDate) return 0
  const diff = new Date(expiryDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function WarrantyPage() {
  const navigate = useNavigate()

  const { data: claims = [] } = useQuery({
    queryKey: ['warranty_claims'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warranty_claims')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as WarrantyClaim[]
    },
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['warranty_projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, client_name, warranty_expiry, warranty_months, actual_completion_date')
        .not('warranty_expiry', 'is', null)
        .order('warranty_expiry', { ascending: true })
      return (data ?? []) as Project[]
    },
  })

  const open = claims.filter((c) => c.status !== 'resolved' && c.status !== 'denied')

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto lg:px-8 lg:py-6">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </button>

      <div>
        <h1 className="font-display text-3xl text-[var(--navy)]">Warranty</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {projects.length} active warranties · {open.length} open claim{open.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Active warranties */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          Active warranties
        </p>
        <Card padding="none">
          {projects.length === 0 && (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No active warranties.</div>
          )}
          {projects.map((p) => {
            const days = daysRemaining(p.warranty_expiry)
            const isExpiring = days <= 60
            const openForProject = claims.filter(c => c.project_id === p.id && c.status !== 'resolved' && c.status !== 'denied').length
            return (
              <div key={p.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isExpiring ? 'bg-[var(--warning-bg)]' : 'bg-[var(--success-bg)]'}`}>
                    <ShieldCheck size={17} className={isExpiring ? 'text-[var(--warning)]' : 'text-[var(--success)]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)]">{p.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{p.client_name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      Expires {p.warranty_expiry} · {days} days remaining
                    </p>
                  </div>
                  {openForProject > 0 && (
                    <span className="text-[10px] font-semibold uppercase bg-[var(--rust-subtle)] text-[var(--rust)] px-2 py-0.5 rounded-full flex-shrink-0">
                      {openForProject} open
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      {/* Open claims */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          Open claims
        </p>
        <Card padding="none">
          {open.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No warranty claims.</div>
          ) : (
            open.map((c) => (
              <div key={c.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-mono text-[10px] text-[var(--text-tertiary)]">{c.id.slice(0, 8).toUpperCase()}</p>
                  <span className="text-[10px] font-semibold uppercase bg-[var(--warning-bg)] text-[var(--warning)] px-2 py-0.5 rounded-full">
                    {c.status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">{c.description}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {projects.find(p => p.id === c.project_id)?.title ?? c.project_id} · reported {c.reported_at?.slice(0, 10)}
                </p>
                {c.reported_by && (
                  <div className="flex items-center gap-1 mt-2 text-[var(--warning)]">
                    <AlertTriangle size={11} />
                    <p className="text-[11px]">Reported by: {c.reported_by}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
