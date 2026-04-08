import { useEffect, useState } from 'react'
import { Check, X, Copy, ExternalLink, GitPullRequest, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type Priority = 'critical' | 'high' | 'medium' | 'low'
type Category = 'ux_friction' | 'missing_feature' | 'agent_improvement' | 'workflow_optimization' | 'data_quality' | 'performance'
type Status = 'draft' | 'reviewed' | 'approved' | 'in_progress' | 'deployed' | 'dismissed'

interface TemplateSuggestion {
  suggested_additions: Array<{ title: string; description?: string; rationale: string }>
  suggested_removals: Array<{ item_title: string; rationale: string }>
  suggested_edits: Array<{ old_title: string; new_title: string; rationale: string }>
  confidence: string
  summary: string
}

interface ImprovementSpec {
  id: string
  title: string
  problem_statement: string
  evidence: string
  proposed_solution: string
  spec_content?: string
  priority: Priority
  category: Category
  status: Status
  adam_notes?: string
  created_at: string
  // N50: Template improvement metadata
  metadata?: {
    source?: string
    deliverable_type?: string
    template_id?: string
    template_name?: string
    instances_analyzed?: number
    analysis?: TemplateSuggestion
  }
}

type PrStatus = 'draft' | 'pr_opened' | 'approved' | 'merged' | 'deployed' | 'closed' | 'failed'
type ChangeCategory = 'data_insert' | 'data_update' | 'copy_change' | 'claude_code'

interface ImprovementPr {
  id: string
  improvement_spec_id: string
  pr_number?: number | null
  pr_url?: string | null
  pr_title: string
  branch_name: string
  change_category: ChangeCategory
  status: PrStatus
  deployed_at?: string | null
  error_message?: string | null
  created_at: string
}


const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  high:     'bg-orange-50 text-orange-700',
  medium:   'bg-[var(--warning-bg)] text-[var(--warning)]',
  low:      'bg-[var(--cream-light)] text-[var(--text-secondary)]',
}

const CATEGORY_LABELS: Record<Category, string> = {
  ux_friction:          'UX Friction',
  missing_feature:      'Missing Feature',
  agent_improvement:    'Agent Issue',
  workflow_optimization:'Workflow',
  data_quality:         'Data Quality',
  performance:          'Performance',
}

type FilterOption = 'all' | Priority | Category

export function ImprovementQueuePage() {
  const [filter, setFilter] = useState<FilterOption>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [prs, setPrs] = useState<Record<string, ImprovementPr>>({})
  const [openingPrId, setOpeningPrId] = useState<string | null>(null)

  const { data: rawImprovements = [], isLoading } = useQuery({
    queryKey: ['improvement_specs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('improvement_specs')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as ImprovementSpec[]
    },
  })

  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<ImprovementSpec>>>({})

  const improvements: ImprovementSpec[] = rawImprovements
    .map(i => ({ ...i, ...localOverrides[i.id] }))
    .filter(i => localOverrides[i.id]?.status !== ('dismissed' as Status))

  const setImprovements = (fn: (prev: ImprovementSpec[]) => ImprovementSpec[]) => {
    const next = fn(improvements)
    const overrides: Record<string, Partial<ImprovementSpec>> = {}
    for (const item of next) {
      overrides[item.id] = item
    }
    // Also track dismissed items (removed from next)
    for (const item of improvements) {
      if (!next.find(n => n.id === item.id)) {
        overrides[item.id] = { ...item, status: 'dismissed' as Status }
      }
    }
    setLocalOverrides(overrides)
  }

  // Fetch PRs from improvement_prs table
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('improvement_prs')
          .select('*')
          .order('created_at', { ascending: false })
        if (error || !data) return
        if (cancelled) return
        const map: Record<string, ImprovementPr> = {}
        for (const row of data as ImprovementPr[]) {
          if (!map[row.improvement_spec_id]) map[row.improvement_spec_id] = row
        }
        setPrs(map)
      } catch {
        // table not yet available — empty state
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const openAutoPr = async (item: ImprovementSpec) => {
    setOpeningPrId(item.id)
    try {
      const { data, error } = await supabase.functions.invoke('meta-agent-open-pr', {
        body: { improvement_spec_id: item.id },
      })
      if (error) throw error
      if (data?.needs_claude_code) {
        setImprovements(prev => prev.map(i => i.id === item.id ? {
          ...i,
          adam_notes: 'This improvement requires Claude Code. Copy the spec and paste it to Claude Code to build.',
        } : i))
      } else if (data?.pr_url) {
        setPrs(prev => ({
          ...prev,
          [item.id]: {
            id: `pr-local-${item.id}`,
            improvement_spec_id: item.id,
            pr_number: data.pr_number,
            pr_url: data.pr_url,
            pr_title: `[Auto] ${item.title}`,
            branch_name: 'auto',
            change_category: (data.change_category ?? 'copy_change') as ChangeCategory,
            status: 'pr_opened',
            created_at: new Date().toISOString(),
          },
        }))
        setImprovements(prev => prev.map(i => i.id === item.id ? { ...i, status: 'in_progress' as Status } : i))
      }
    } catch (err) {
      console.error('openAutoPr failed', err)
      alert('Failed to open auto-PR. Check the edge function logs.')
    } finally {
      setOpeningPrId(null)
    }
  }

  const approve = (id: string) => setImprovements(prev => prev.map(i => i.id === id ? { ...i, status: 'approved' as Status } : i))
  const dismiss = (id: string) => setImprovements(prev => prev.filter(i => i.id !== id))
  const markInProgress = (id: string) => setImprovements(prev => prev.map(i => i.id === id ? { ...i, status: 'in_progress' as Status } : i))
  const markDeployed = (id: string) => setImprovements(prev => prev.map(i => i.id === id ? { ...i, status: 'deployed' as Status } : i))

  const copySpec = (item: ImprovementSpec) => {
    const spec = item.spec_content ?? `# ${item.title}\n\n## Problem\n${item.problem_statement}\n\n## Evidence\n${item.evidence}\n\n## Proposed Solution\n${item.proposed_solution}`
    navigator.clipboard.writeText(spec)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const FILTERS: { key: FilterOption; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'high', label: 'High Priority' },
    { key: 'workflow_optimization', label: 'Template Improvements' },
    { key: 'agent_improvement', label: 'Agent Issues' },
    { key: 'ux_friction', label: 'UX Friction' },
    { key: 'missing_feature', label: 'Missing Features' },
  ]

  const filtered = improvements.filter(i => {
    if (filter === 'all') return i.status !== 'deployed' && i.status !== 'dismissed'
    return (i.priority === filter || i.category === filter) && i.status !== 'deployed' && i.status !== 'dismissed'
  })

  const deployed = improvements.filter(i => i.status === 'deployed')

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Loading improvement queue...</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Improvement Queue" subtitle={`${filtered.length} improvement${filtered.length !== 1 ? 's' : ''} identified by AI`} />

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors min-h-[32px] ${
              filter === f.key ? 'bg-[var(--navy)] text-white' : 'bg-[var(--cream-light)] text-[var(--text-secondary)] hover:bg-[var(--cream)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Improvement cards */}
      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Check size={22} className="text-[var(--success)] mb-2" />
            <p className="font-semibold text-[var(--text)]">All improvements actioned</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">New improvements will appear here after the weekly analysis runs.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id

            return (
              <Card key={item.id}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority]}`}>
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--cream-light)] px-2 py-0.5 rounded-full">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {item.status !== 'draft' && (
                        <span className="text-[10px] font-medium text-[var(--success)] bg-[var(--success-bg)] px-2 py-0.5 rounded-full">
                          {item.status}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-[var(--text)]">{item.title}</p>
                  </div>
                </div>

                <p className="text-sm text-[var(--text-secondary)] mb-2">{item.problem_statement}</p>

                <div className="bg-[var(--bg)] rounded-xl p-3 mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Evidence</p>
                  <p className="text-xs text-[var(--text-secondary)]">{item.evidence}</p>
                </div>

                {isExpanded && (
                  <div className="mb-3 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Proposed Solution</p>
                      <p className="text-sm text-[var(--text-secondary)]">{item.proposed_solution}</p>
                    </div>

                    {/* N50: Template improvement detail view */}
                    {item.metadata?.source === 'template_improvement_suggester' && item.metadata.analysis && (() => {
                      const analysis = item.metadata.analysis
                      return (
                        <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-[var(--navy)] flex items-center justify-between">
                            <span className="text-xs text-white font-medium">
                              Template: {item.metadata.template_name ?? item.metadata.deliverable_type}
                            </span>
                            <span className="text-[10px] text-white/70">
                              {item.metadata.instances_analyzed} projects analyzed
                            </span>
                          </div>
                          <div className="divide-y divide-[var(--border-light)]">
                            {analysis.suggested_additions.map((sug, idx) => (
                              <div key={`add-${idx}`} className="flex items-start gap-3 p-3 bg-[var(--success-bg)]">
                                <span className="text-xs font-semibold text-[var(--success)] w-16 shrink-0 mt-0.5">+ Add</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--text)]">{sug.title}</p>
                                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sug.rationale}</p>
                                </div>
                              </div>
                            ))}
                            {analysis.suggested_removals.map((sug, idx) => (
                              <div key={`rem-${idx}`} className="flex items-start gap-3 p-3 bg-[var(--danger-bg)]">
                                <span className="text-xs font-semibold text-[var(--danger)] w-16 shrink-0 mt-0.5">- Remove</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--text)]">{sug.item_title}</p>
                                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sug.rationale}</p>
                                </div>
                              </div>
                            ))}
                            {analysis.suggested_edits.map((sug, idx) => (
                              <div key={`edit-${idx}`} className="flex items-start gap-3 p-3 bg-[var(--warning-bg)]">
                                <span className="text-xs font-semibold text-[var(--warning)] w-16 shrink-0 mt-0.5">~ Edit</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--text)]">
                                    "{sug.old_title}" → "{sug.new_title}"
                                  </p>
                                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sug.rationale}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-3 py-2 bg-[var(--bg)] border-t border-[var(--border-light)]">
                            <p className="text-xs text-[var(--text-tertiary)]">
                              Confidence: <span className="font-medium text-[var(--text)]">{analysis.confidence}</span>
                              {' · '}To apply: open
                              {' '}<span className="text-[var(--navy)] font-medium">Templates → {item.metadata.template_name}</span>
                              {' '}and make these changes.
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="text-xs text-[var(--navy)] font-medium mb-3"
                >
                  {isExpanded ? 'Show less' : 'View proposed solution →'}
                </button>

                {/* PR status block */}
                {(() => {
                  const pr = prs[item.id]
                  if (!pr) return null
                  if (pr.status === 'pr_opened' || pr.status === 'approved') {
                    return (
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          <GitPullRequest size={10} /> Auto-PR opened
                        </span>
                        {pr.pr_url && (
                          <a
                            href={pr.pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--navy)] underline"
                          >
                            Review on GitHub <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    )
                  }
                  if (pr.status === 'merged' || pr.status === 'deployed') {
                    return (
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                          <Check size={10} /> Merged
                        </span>
                        {pr.deployed_at && (
                          <span className="text-[11px] text-[var(--text-tertiary)]">
                            Deployed at {new Date(pr.deployed_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )
                  }
                  if (pr.status === 'closed') {
                    return (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--cream-light)] text-[var(--text-secondary)]">
                          Closed
                        </span>
                      </div>
                    )
                  }
                  if (pr.status === 'failed') {
                    return (
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--danger-bg)] text-[var(--danger)]">
                          Failed
                        </span>
                        {pr.error_message && (
                          <span className="text-[11px] text-[var(--text-secondary)]">{pr.error_message}</span>
                        )}
                      </div>
                    )
                  }
                  if (pr.change_category === 'claude_code') {
                    return (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
                          Requires Claude Code
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Actions */}
                {(item.status === 'draft' || item.status === 'reviewed') ? (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => approve(item.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--navy)] text-white text-xs font-semibold min-h-[44px]">
                      <Check size={13} />
                      Approve for Claude Code
                    </button>
                    {!prs[item.id] && (
                      <button
                        onClick={() => openAutoPr(item)}
                        disabled={openingPrId === item.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--navy)]/20 bg-[var(--cream-light)] text-[var(--navy)] text-xs font-semibold min-h-[44px] disabled:opacity-60"
                      >
                        {openingPrId === item.id ? <Loader2 size={13} className="animate-spin" /> : <GitPullRequest size={13} />}
                        {openingPrId === item.id ? 'Opening PR...' : 'Open auto-PR'}
                      </button>
                    )}
                    <button onClick={() => dismiss(item.id)} className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center min-h-[44px]">
                      <X size={13} />
                    </button>
                  </div>
                ) : item.status === 'approved' ? (
                  <div className="flex gap-2">
                    <button onClick={() => copySpec(item)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--cream-light)] text-[var(--navy)] text-xs font-semibold min-h-[44px] border border-[var(--navy)]/20">
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === item.id ? 'Copied!' : 'Copy spec for Claude Code'}
                    </button>
                    <button onClick={() => markInProgress(item.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold min-h-[44px]">
                      Mark in progress
                    </button>
                  </div>
                ) : item.status === 'in_progress' ? (
                  <button onClick={() => markDeployed(item.id)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--success)] text-white text-xs font-semibold min-h-[44px]">
                    <Check size={13} />
                    Mark as deployed
                  </button>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      {/* Deployed improvements */}
      {deployed.length > 0 && (
        <div>
          <SectionHeader title={`Deployed (${deployed.length})`} />
          <Card padding="none">
            {deployed.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
                <Check size={14} className="text-[var(--success)] flex-shrink-0" />
                <p className="text-sm text-[var(--text-secondary)] flex-1">{item.title}</p>
                <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">deployed</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
