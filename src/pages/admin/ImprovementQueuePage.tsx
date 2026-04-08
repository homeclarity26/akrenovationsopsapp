import { useEffect, useState } from 'react'
import { Check, X, Copy, ExternalLink, GitPullRequest, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

type Priority = 'critical' | 'high' | 'medium' | 'low'
type Category = 'ux_friction' | 'missing_feature' | 'agent_improvement' | 'workflow_optimization' | 'data_quality' | 'performance'
type Status = 'draft' | 'reviewed' | 'approved' | 'in_progress' | 'deployed' | 'dismissed'

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

const MOCK_PRS: Record<string, ImprovementPr> = {
  'imp-2': {
    id: 'pr-mock-2',
    improvement_spec_id: 'imp-2',
    pr_number: 42,
    pr_url: 'https://github.com/homeclarity26/akrenovationsopsapp/pull/42',
    pr_title: '[Auto] Morning brief should be pinned at top of dashboard',
    branch_name: 'improvement/abc12345-morning-brief',
    change_category: 'copy_change',
    status: 'pr_opened',
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
}

const MOCK_IMPROVEMENTS: ImprovementSpec[] = [
  {
    id: 'imp-1',
    title: 'Quote entry form loses data on back navigation',
    problem_statement: 'When adding a quote in the budget module, navigating away from the trade and coming back clears the partially-entered form.',
    evidence: 'Navigated away from quote entry form 7 times this week without completing. Average time on budget screen: 4.2 minutes (suggests friction).',
    proposed_solution: 'Persist form state in local component state via a parent-level useState in QuoteCollection, or use sessionStorage to preserve in-progress form data between navigation events.',
    priority: 'high',
    category: 'ux_friction',
    status: 'draft',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'imp-2',
    title: 'Morning brief should be pinned at top of dashboard',
    problem_statement: "The morning brief is generated daily but only lives in the agent outputs feed, which Adam has to scroll to find. It's the most important content of the day.",
    evidence: 'Admin dashboard usage: 8 seconds average before navigating away. Morning brief opened: 2 times in 7 days.',
    proposed_solution: "Add a \"Today's Brief\" card at the very top of AdminDashboard.tsx that pulls the latest agent_outputs record from agent-morning-brief and displays the first 3-4 lines with a \"Read full brief\" expand.",
    priority: 'high',
    category: 'workflow_optimization',
    status: 'draft',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'imp-3',
    title: 'Lead aging agent output format not scannable',
    problem_statement: 'The lead aging agent drafts follow-up messages but they appear as one long text block. Adam has to read the whole thing to find the action.',
    evidence: 'Lead aging outputs: dismissed 60% of the time. Average review time before dismiss: 3 seconds (not enough time to read).',
    proposed_solution: 'Restructure agent output format: bold the lead name and recommended action in the first line, then show the draft message below in a collapsible section.',
    priority: 'medium',
    category: 'agent_improvement',
    status: 'draft',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
]

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
  const [improvements, setImprovements] = useState<ImprovementSpec[]>(MOCK_IMPROVEMENTS)
  const [filter, setFilter] = useState<FilterOption>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [prs, setPrs] = useState<Record<string, ImprovementPr>>(MOCK_PRS)
  const [openingPrId, setOpeningPrId] = useState<string | null>(null)

  // Best-effort real fetch of improvement_prs — falls back to mock data.
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
          // Keep most recent per spec
          if (!map[row.improvement_spec_id]) map[row.improvement_spec_id] = row
        }
        if (Object.keys(map).length) setPrs(map)
      } catch {
        // stub db or offline — keep mock data
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
    { key: 'agent_improvement', label: 'Agent Issues' },
    { key: 'ux_friction', label: 'UX Friction' },
    { key: 'missing_feature', label: 'Missing Features' },
  ]

  const filtered = improvements.filter(i => {
    if (filter === 'all') return i.status !== 'deployed' && i.status !== 'dismissed'
    return (i.priority === filter || i.category === filter) && i.status !== 'deployed' && i.status !== 'dismissed'
  })

  const deployed = improvements.filter(i => i.status === 'deployed')

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
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Proposed Solution</p>
                    <p className="text-sm text-[var(--text-secondary)]">{item.proposed_solution}</p>
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
