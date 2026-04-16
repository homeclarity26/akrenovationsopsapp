import { useState } from 'react'
import { Check, X, PlayCircle, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Priority = 'low' | 'medium' | 'high' | 'critical'
type Status = 'open' | 'acknowledged' | 'in_progress' | 'done' | 'dismissed'

interface ImprovementSuggestion {
  id: string
  company_id: string
  category: string
  title: string
  description: string
  rationale: string | null
  priority: Priority
  status: Status
  source: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

interface ReviewerProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

const PRIORITY_STYLE: Record<Priority, string> = {
  critical: 'bg-[var(--danger)] text-white',
  high:     'bg-[var(--danger-bg)] text-[var(--danger)]',
  medium:   'bg-[var(--warning-bg)] text-[var(--warning)]',
  low:      'bg-[var(--cream-light)] text-[var(--text-secondary)]',
}

// Higher number = higher priority for ORDER BY priority DESC.
const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const COLUMN_ORDER: { status: Exclude<Status, 'done' | 'dismissed'>; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { status: 'open',          label: 'Open',          icon: Clock },
  { status: 'acknowledged',  label: 'Acknowledged',  icon: CheckCircle2 },
  { status: 'in_progress',   label: 'In progress',   icon: PlayCircle },
]

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

export function ImprovementQueuePage() {
  const { user } = useAuth()
  const companyId = user?.company_id ?? null
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: suggestions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['improvement_suggestions', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [] as ImprovementSuggestion[]
      const { data, error } = await supabase
        .from('improvement_suggestions')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['open', 'acknowledged', 'in_progress'])
      if (error) throw error
      const rows = (data ?? []) as ImprovementSuggestion[]
      return rows.sort((a, b) => {
        const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
        if (pw !== 0) return pw
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    },
  })

  const reviewerIds = Array.from(
    new Set(suggestions.map(s => s.reviewed_by).filter((v): v is string => !!v))
  )

  const { data: reviewers = [] } = useQuery({
    queryKey: ['improvement_suggestion_reviewers', reviewerIds],
    enabled: reviewerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', reviewerIds)
      if (error) return [] as ReviewerProfile[]
      return (data ?? []) as ReviewerProfile[]
    },
  })
  const reviewerById = new Map(reviewers.map(r => [r.id, r]))

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      if (!user?.id) throw new Error('Not signed in')
      const { error } = await supabase
        .from('improvement_suggestions')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['improvement_suggestions', companyId] })
    },
  })

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Loading improvement queue...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Unable to load improvement queue. Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg"
        >
          Retry
        </button>
      </div>
    )
  }

  const grouped: Record<typeof COLUMN_ORDER[number]['status'], ImprovementSuggestion[]> = {
    open: [],
    acknowledged: [],
    in_progress: [],
  }
  for (const s of suggestions) {
    if (s.status === 'open' || s.status === 'acknowledged' || s.status === 'in_progress') {
      grouped[s.status].push(s)
    }
  }

  const totalActive = grouped.open.length + grouped.acknowledged.length + grouped.in_progress.length

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Improvement Queue"
        subtitle={
          totalActive === 0
            ? 'No active suggestions'
            : `${totalActive} active suggestion${totalActive === 1 ? '' : 's'}`
        }
      />

      {totalActive === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Check size={22} className="text-[var(--success)] mb-2" />
            <p className="font-semibold text-[var(--text)]">No improvement suggestions yet.</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              The improvement-analysis agent runs weekly and will drop new items here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {COLUMN_ORDER.map(col => {
            const Icon = col.icon
            const items = grouped[col.status]
            return (
              <div key={col.status}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Icon size={14} className="text-[var(--text-tertiary)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    {col.label}
                  </p>
                  <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                    ({items.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <Card>
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-2">None</p>
                    </Card>
                  ) : (
                    items.map(item => {
                      const isExpanded = expandedId === item.id
                      const reviewer = item.reviewed_by ? reviewerById.get(item.reviewed_by) : undefined
                      return (
                        <Card key={item.id}>
                          <div className="flex items-start gap-2 flex-wrap mb-2">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_STYLE[item.priority]}`}>
                              {item.priority}
                            </span>
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--cream-light)] px-2 py-0.5 rounded-full">
                              {item.category}
                            </span>
                            {reviewer && (
                              <span
                                title={`Reviewed by ${reviewer.full_name ?? 'team member'}`}
                                className="ml-auto flex items-center justify-center w-6 h-6 rounded-full bg-[var(--navy)] text-white text-[10px] font-semibold"
                              >
                                {initials(reviewer.full_name)}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-[var(--text)] mb-1">{item.title}</p>
                          <p className={`text-xs text-[var(--text-secondary)] ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {item.description}
                          </p>
                          {isExpanded && item.rationale && (
                            <div className="mt-2 bg-[var(--bg)] rounded-lg p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                                Rationale
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">{item.rationale}</p>
                            </div>
                          )}
                          {item.rationale && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="mt-2 flex items-center text-[11px] text-[var(--navy)] font-medium"
                            >
                              {isExpanded ? 'Show less' : 'Show rationale'}
                              <ChevronRight
                                size={11}
                                className={`ml-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </button>
                          )}

                          {/* Actions */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.status === 'open' && (
                              <button
                                onClick={() => updateMutation.mutate({ id: item.id, status: 'acknowledged' })}
                                disabled={updateMutation.isPending}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--cream-light)] text-[var(--navy)] border border-[var(--navy)]/20 disabled:opacity-60 min-h-[32px]"
                              >
                                Acknowledge
                              </button>
                            )}
                            {(item.status === 'open' || item.status === 'acknowledged') && (
                              <button
                                onClick={() => updateMutation.mutate({ id: item.id, status: 'in_progress' })}
                                disabled={updateMutation.isPending}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--navy)] text-white disabled:opacity-60 min-h-[32px]"
                              >
                                Start
                              </button>
                            )}
                            {item.status === 'in_progress' && (
                              <button
                                onClick={() => updateMutation.mutate({ id: item.id, status: 'done' })}
                                disabled={updateMutation.isPending}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--success)] text-white disabled:opacity-60 min-h-[32px]"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Check size={11} /> Done
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() => updateMutation.mutate({ id: item.id, status: 'dismissed' })}
                              disabled={updateMutation.isPending}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-60 min-h-[32px]"
                            >
                              <span className="inline-flex items-center gap-1">
                                <X size={11} /> Dismiss
                              </span>
                            </button>
                          </div>
                        </Card>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
