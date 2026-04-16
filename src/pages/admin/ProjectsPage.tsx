import { useState } from 'react'
import { Plus, X, FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { SkeletonRow } from '@/components/ui/Skeleton'

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', client_name: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const { data: projects = [], isLoading, error, refetch } = useQuery({
    queryKey: ['projects', user?.company_id],
    queryFn: async () => {
      const { data, error: supaError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (supaError) throw supaError
      return data ?? []
    },
  })

  const resetForm = () => {
    setForm({ title: '', client_name: '' })
    setCreateError(null)
  }

  const handleCreate = async () => {
    const title = form.title.trim()
    if (!title) {
      setCreateError('Project name is required')
      return
    }
    setCreating(true)
    setCreateError(null)
    const { error: insertError } = await supabase.from('projects').insert({
      title,
      client_name: form.client_name.trim() || null,
      status: 'planning',
      company_id: user?.company_id ?? null,
    })
    setCreating(false)
    if (insertError) {
      setCreateError(insertError.message)
      return
    }
    setShowNew(false)
    resetForm()
    queryClient.invalidateQueries({ queryKey: ['projects', user?.company_id] })
    toast.success('Project created')
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load projects. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} total projects`}
        action={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus size={15} />New Project
          </Button>
        }
      />

      {showNew && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-[var(--text)]">New Project</h3>
            <button
              type="button"
              onClick={() => { setShowNew(false); resetForm() }}
              className="p-1 rounded hover:bg-gray-100 text-[var(--text-tertiary)]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Project name"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
            />
            <input
              type="text"
              placeholder="Client name (optional)"
              value={form.client_name}
              onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
            />
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setShowNew(false); resetForm() }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card padding="none"><SkeletonRow count={4} /></Card>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 px-4">
          <FolderOpen size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="font-medium text-sm text-[var(--text)]">No projects yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto">Use the AI site walk to create your first estimate, or add a project manually.</p>
          <button onClick={() => setShowNew(true)} className="mt-4 text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-4 py-2 rounded-xl hover:bg-[var(--navy)]/5 transition-colors">
            <Plus size={13} className="inline -mt-0.5 mr-1" />Create Project
          </button>
        </div>
      ) : (
        <Card padding="none">
          {projects.map((p: Record<string, unknown>) => {
            const pId = String(p.id ?? '')
            const pTitle = String(p.title ?? '')
            const pStatus = String(p.status ?? '')
            const pScheduleStatus = String(p.schedule_status ?? '')
            const pClientName = String(p.client_name ?? '')
            const pCurrentPhase = p.current_phase ? String(p.current_phase) : ''
            const pPercentComplete = Number(p.percent_complete ?? 0)
            const pContractValue = Number(p.contract_value ?? 0)
            const pProjectType = String(p.project_type ?? '')
            return (
              <div
                key={pId}
                onClick={() => navigate(`/admin/projects/${pId}`)}
                className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm text-[var(--text)]">{pTitle}</p>
                    <StatusPill status={pStatus} />
                    {pStatus === 'active' && <StatusPill status={pScheduleStatus} />}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-1">{pClientName}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{pCurrentPhase}</p>
                  {pStatus === 'active' && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--navy)] rounded-full"
                          style={{ width: `${pPercentComplete}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{pPercentComplete}%</span>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-semibold text-[var(--text)]">
                    ${(pContractValue / 1000).toFixed(0)}K
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5 capitalize">{pProjectType}</p>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
