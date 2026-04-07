import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { MOCK_PROJECTS } from '@/data/mock'

export function ProjectsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Projects"
        subtitle={`${MOCK_PROJECTS.length} total projects`}
        action={<Button size="sm"><Plus size={15} />New Project</Button>}
      />

      <Card padding="none">
        {MOCK_PROJECTS.map(p => (
          <div
            key={p.id}
            onClick={() => navigate(`/admin/projects/${p.id}`)}
            className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-sm text-[var(--text)]">{p.title}</p>
                <StatusPill status={p.status} />
                {p.status === 'active' && <StatusPill status={p.schedule_status} />}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">{p.client_name}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{p.current_phase}</p>
              {p.status === 'active' && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--navy)] rounded-full"
                      style={{ width: `${p.percent_complete}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{p.percent_complete}%</span>
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-sm font-semibold text-[var(--text)]">
                ${(p.contract_value / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5 capitalize">{p.project_type}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
