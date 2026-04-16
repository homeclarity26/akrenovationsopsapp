import { useQuery } from '@tanstack/react-query'
import { Card, MetricCard } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CheckCircle, Circle, Loader } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useClientProject } from '@/hooks/useClientProject'
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton'

interface Phase {
  id: string
  name: string
  status: 'upcoming' | 'active' | 'complete'
  percent_complete: number | null
  sort_order: number
}

interface DailyLogRow {
  id: string
  summary: string
  work_completed: string | null
  log_date: string
  created_at: string
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatCompact(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ClientProgress() {
  const { data: project, isLoading: projectLoading } = useClientProject()
  const projectId = project?.id ?? null

  const { data: phases = [] } = useQuery<Phase[]>({
    queryKey: ['client-phases', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, name, status, percent_complete, sort_order')
        .eq('project_id', projectId!)
        .order('sort_order', { ascending: true })
      if (error) {
        console.warn('[ClientProgress] phases error:', error.message)
        return []
      }
      return (data ?? []) as Phase[]
    },
  })

  const { data: latestLog } = useQuery<DailyLogRow | null>({
    queryKey: ['client-latest-log', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('id, summary, work_completed, log_date, created_at')
        .eq('project_id', projectId!)
        .eq('visible_to_client', true)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) {
        console.warn('[ClientProgress] daily_logs error:', error.message)
        return null
      }
      return (data ?? null) as DailyLogRow | null
    },
  })

  if (projectLoading) {
    return (
      <div className="p-4 space-y-5 max-w-lg mx-auto">
        <div className="bg-[var(--border)] rounded-xl p-4 animate-pulse h-24" />
        <div className="grid grid-cols-3 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonText lines={3} />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <Card>
          <p className="font-semibold text-[var(--text)] mb-1">No project yet</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Your contractor hasn't linked a project to your account. You'll see updates here once the project is set up.
          </p>
        </Card>
      </div>
    )
  }

  const percent = typeof project.percent_complete === 'number' ? project.percent_complete : 0
  const contractDisplay = typeof project.contract_value === 'number' && project.contract_value > 0
    ? `$${(project.contract_value / 1000).toFixed(1)}K`
    : '—'
  const completionDisplay = formatCompact(project.target_completion_date)

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      {/* Welcome */}
      <div className="bg-[var(--navy)] rounded-xl p-4">
        <p className="text-white/60 text-xs mb-1">Your Project</p>
        <h1 className="font-display text-white text-2xl mb-0.5">{project.title}</h1>
        {project.address && (
          <p className="text-white/60 text-sm">{project.address}</p>
        )}
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Complete" value={`${percent}%`} subtitle={project.status === 'active' ? 'In progress' : project.status ?? ''} />
        <MetricCard label="Est. Done" value={completionDisplay} subtitle="" />
        <MetricCard label="Contract" value={contractDisplay} subtitle="Signed" />
      </div>

      {/* Phase tracker */}
      <div>
        <SectionHeader title="Project Phases" />
        {phases.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)]">
              Phases will appear here once your contractor sets up the project timeline.
            </p>
          </Card>
        ) : (
          <Card padding="none">
            {phases.map((phase) => {
              const pct = phase.percent_complete ?? 0
              return (
                <div key={phase.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex-shrink-0">
                    {phase.status === 'complete' && <CheckCircle size={20} className="text-[var(--success)]" />}
                    {phase.status === 'active' && <Loader size={20} className="text-[var(--navy)] animate-spin" />}
                    {phase.status === 'upcoming' && <Circle size={20} className="text-[var(--border)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${phase.status === 'upcoming' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text)]'}`}>
                      {phase.name}
                    </p>
                    {phase.status === 'active' && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{pct}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {phase.status === 'complete' && (
                      <span className="text-[11px] text-[var(--success)] font-medium">Done</span>
                    )}
                    {phase.status === 'upcoming' && (
                      <span className="text-[11px] text-[var(--text-tertiary)]">Upcoming</span>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      {/* Latest update */}
      <div>
        <SectionHeader title="Latest Update" />
        {latestLog ? (
          <Card>
            <p className="text-xs text-[var(--text-tertiary)] mb-2">{formatShortDate(latestLog.log_date)}</p>
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-line">
              {latestLog.summary}
              {latestLog.work_completed ? `\n\n${latestLog.work_completed}` : ''}
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-[var(--text-secondary)]">
              No updates shared yet. Your contractor will post progress updates here.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
