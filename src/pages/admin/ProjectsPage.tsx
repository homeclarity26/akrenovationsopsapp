import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

export function ProjectsPage() {
  const navigate = useNavigate()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} total projects`}
        action={<Button size="sm"><Plus size={15} />New Project</Button>}
      />

      {isLoading ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="font-medium text-sm text-[var(--text)]">No projects yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Use the AI site walk to create your first estimate.</p>
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
