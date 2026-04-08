import { useState } from 'react'
import { Brain, Search, Plus, Trash2, Check, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type MemoryTab = 'business_context' | 'operational_memory' | 'agent_history' | 'learning_insights'

interface BusinessContextEntry {
  id: string
  category: string
  key: string
  value: string
  source: 'manual' | 'meta_agent' | 'admin_action'
  last_confirmed_at: string
}

interface OperationalMemoryEntry {
  id: string
  entity_type: string
  entity_id: string
  entity_name: string
  memory_type: string
  content: string
  confidence: number
  source: string
  created_at: string
}

interface AgentHistoryEntry {
  id: string
  agent_name: string
  run_at: string
  output_type: string
  output_summary: string
  admin_action: string
  edit_distance: number | null
  rejection_reason: string | null
}

interface LearningInsight {
  id: string
  insight_type: string
  title: string
  insight: string
  evidence: string | null
  confidence: number
  actioned: boolean
  generated_at: string
}




const MEMORY_TYPE_COLORS: Record<string, string> = {
  fact:         'bg-blue-50 text-blue-700',
  pattern:      'bg-purple-50 text-purple-700',
  preference:   'bg-green-50 text-green-700',
  warning:      'bg-[var(--warning-bg)] text-[var(--warning)]',
  relationship: 'bg-[var(--cream-light)] text-[var(--navy)]',
  outcome:      'bg-[var(--success-bg)] text-[var(--success)]',
}

const INSIGHT_TYPE_COLORS: Record<string, string> = {
  sub_performance:    'bg-teal-50 text-teal-700',
  client_behavior:    'bg-pink-50 text-pink-700',
  project_financials: 'bg-green-50 text-green-700',
  agent_performance:  'bg-orange-50 text-orange-700',
  workflow_pattern:   'bg-blue-50 text-blue-700',
  improvement_signal: 'bg-[var(--rust-subtle)] text-[var(--rust)]',
}

const ACTION_COLORS: Record<string, string> = {
  approved:            'text-[var(--success)]',
  approved_with_edits: 'text-[var(--warning)]',
  rejected:            'text-[var(--danger)]',
  dismissed:           'text-[var(--text-tertiary)]',
  auto_executed:       'text-[var(--navy)]',
  pending:             'text-[var(--text-tertiary)]',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MemoryInspectorPage() {
  const [activeTab, setActiveTab]       = useState<MemoryTab>('business_context')
  const [search, setSearch]             = useState('')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editValue, setEditValue]       = useState('')
  const { data: bcData = [] } = useQuery({
    queryKey: ['memory_business_context'],
    queryFn: async () => {
      const { data } = await supabase.from('business_context').select('*').order('category')
      return (data ?? []) as BusinessContextEntry[]
    },
  })
  const { data: omData = [] } = useQuery({
    queryKey: ['memory_operational_memory'],
    queryFn: async () => {
      const { data } = await supabase.from('operational_memory').select('*').order('created_at', { ascending: false })
      return (data ?? []) as OperationalMemoryEntry[]
    },
  })
  const { data: agData = [] } = useQuery({
    queryKey: ['memory_agent_history'],
    queryFn: async () => {
      const { data } = await supabase.from('agent_history').select('*').order('run_at', { ascending: false })
      return (data ?? []) as AgentHistoryEntry[]
    },
  })
  const { data: insightsBase = [] } = useQuery({
    queryKey: ['memory_learning_insights'],
    queryFn: async () => {
      const { data } = await supabase.from('learning_insights').select('*').order('generated_at', { ascending: false })
      return (data ?? []) as LearningInsight[]
    },
  })

  const [bcEntries, setBcEntries] = useState<BusinessContextEntry[]>([])
  const [omEntries]               = useState<OperationalMemoryEntry[]>([])
  const [agHistory]               = useState<AgentHistoryEntry[]>([])
  const [insights, setInsights]   = useState<LearningInsight[]>([])

  // Seed local state from query data (allows optimistic in-place edits)
  const displayBc       = bcEntries.length   > 0 ? bcEntries   : bcData
  const displayOm       = omEntries.length   > 0 ? omEntries   : omData
  const displayHistory  = agHistory.length   > 0 ? agHistory   : agData
  const displayInsights = insights.length    > 0 ? insights    : insightsBase
  const [agentFilter, setAgentFilter]   = useState('all')
  const [insightFilter, setInsightFilter] = useState('all')
  const [refreshing, setRefreshing]     = useState(false)

  const TABS: { id: MemoryTab; label: string; count: number }[] = [
    { id: 'business_context',   label: 'Business Context',   count: displayBc.length },
    { id: 'operational_memory', label: 'Operational Memory', count: displayOm.length },
    { id: 'agent_history',      label: 'Agent History',      count: displayHistory.length },
    { id: 'learning_insights',  label: 'Learning Insights',  count: displayInsights.filter(i => !i.actioned).length },
  ]

  const simulateRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }

  const saveEdit = (id: string) => {
    const base = bcEntries.length > 0 ? bcEntries : bcData
    setBcEntries(base.map(e => e.id === id ? { ...e, value: editValue } : e))
    setEditingId(null)
  }

  const markInsightActioned = (id: string) => {
    const base = insights.length > 0 ? insights : insightsBase
    setInsights(base.map(i => i.id === id ? { ...i, actioned: true } : i))
  }

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredBC = displayBc.filter(e =>
    !search || e.key.toLowerCase().includes(search.toLowerCase()) || e.value.toLowerCase().includes(search.toLowerCase())
  )

  const bcCategories = Array.from(new Set(filteredBC.map(e => e.category)))

  const filteredOM = displayOm.filter(e =>
    !search || e.content.toLowerCase().includes(search.toLowerCase()) || e.entity_name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredHistory = displayHistory.filter(e =>
    (agentFilter === 'all' || e.agent_name === agentFilter) &&
    (!search || e.output_summary.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredInsights = displayInsights.filter(i =>
    (insightFilter === 'all' || i.insight_type === insightFilter) &&
    (!search || i.title.toLowerCase().includes(search.toLowerCase()) || i.insight.toLowerCase().includes(search.toLowerCase()))
  )

  const agentNames = Array.from(new Set(displayHistory.map(h => h.agent_name)))

  return (
    <div className="max-w-2xl mx-auto lg:max-w-4xl px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl text-[var(--navy)]">Memory Inspector</h1>
            <p className="text-xs text-[var(--text-tertiary)]">The AI's knowledge of your business</p>
          </div>
        </div>
        <button
          onClick={simulateRefresh}
          className={cn('p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors', refreshing && 'opacity-60')}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Search memory..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tab row */}
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border-light)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSearch('') }}
            className={cn(
              'py-2.5 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5',
              activeTab === t.id
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                activeTab === t.id ? 'bg-[var(--navy)] text-white' : 'bg-[var(--border-light)] text-[var(--text-tertiary)]'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── BUSINESS CONTEXT ── */}
      {activeTab === 'business_context' && (
        <div className="space-y-4">
          {bcCategories.map(cat => (
            <div key={cat}>
              <SectionHeader title={cat.replace('_', ' ')} />
              <Card padding="none">
                {filteredBC.filter(e => e.category === cat).map(entry => {
                  const isExpanded = expandedId === entry.id
                  const isEditing  = editingId === entry.id
                  return (
                    <div key={entry.id} className="border-b border-[var(--border-light)] last:border-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="w-full flex items-start gap-3 px-4 py-3.5 text-left min-h-[44px]"
                      >
                        {isExpanded
                          ? <ChevronDown size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                          : <ChevronRight size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text)]">{entry.key.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{entry.value}</p>
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0',
                          entry.source === 'meta_agent' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        )}>
                          {entry.source.replace('_', ' ')}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {isEditing ? (
                            <>
                              <textarea
                                className="w-full py-2 px-3 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
                                rows={3}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button onClick={() => saveEdit(entry.id)} className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-xs font-semibold min-h-[44px]">Save</button>
                                <button onClick={() => setEditingId(null)} className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] min-h-[44px]">Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-[var(--text)] leading-relaxed bg-[var(--bg)] rounded-xl p-3">{entry.value}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-[var(--text-tertiary)]">Last confirmed {entry.last_confirmed_at}</p>
                                <button
                                  onClick={() => { setEditingId(entry.id); setEditValue(entry.value) }}
                                  className="text-xs font-semibold text-[var(--navy)] underline underline-offset-2"
                                >
                                  Edit
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}

          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--navy)] font-medium hover:bg-[var(--cream-light)] transition-colors min-h-[44px]">
            <Plus size={14} />
            Add entry
          </button>
        </div>
      )}

      {/* ── OPERATIONAL MEMORY ── */}
      {activeTab === 'operational_memory' && (
        <div className="space-y-3">
          {filteredOM.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-[var(--text-tertiary)] py-4">No memory entries yet. They'll appear as projects and leads are created and updated.</p>
            </Card>
          ) : (
            filteredOM.map(entry => (
              <Card key={entry.id}>
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full', MEMORY_TYPE_COLORS[entry.memory_type] ?? 'bg-gray-100 text-gray-600')}>
                        {entry.memory_type}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--navy)]">{entry.entity_name}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] capitalize">{entry.entity_type}</span>
                    </div>
                    <p className="text-sm text-[var(--text)] leading-relaxed">{entry.content}</p>
                  </div>
                  <button className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[var(--text-tertiary)]">{entry.source.replace('_', ' ')} · {entry.created_at}</p>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${entry.confidence * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{(entry.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── AGENT HISTORY ── */}
      {activeTab === 'agent_history' && (
        <div className="space-y-4">
          {/* Agent filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['all', ...agentNames].map(name => (
              <button
                key={name}
                onClick={() => setAgentFilter(name)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  agentFilter === name ? 'bg-[var(--navy)] text-white' : 'bg-[var(--border-light)] text-[var(--text-secondary)]'
                )}
              >
                {name === 'all' ? 'All agents' : name.replace('agent-', '').replace(/-/g, ' ')}
              </button>
            ))}
          </div>

          <Card padding="none">
            {filteredHistory.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No agent history yet.</div>
            ) : (
              filteredHistory.map(h => (
                <div key={h.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--navy)] mb-0.5">
                        {h.agent_name.replace('agent-', '').replace(/-/g, ' ')}
                      </p>
                      <p className="text-sm text-[var(--text)] leading-relaxed">{h.output_summary}</p>
                    </div>
                    <span className={cn('text-xs font-semibold flex-shrink-0', ACTION_COLORS[h.admin_action] ?? 'text-[var(--text-tertiary)]')}>
                      {h.admin_action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[11px] text-[var(--text-tertiary)]">{h.run_at}</p>
                    {(h.edit_distance ?? 0) > 0 && (
                      <span className="text-[10px] text-[var(--warning)]">Edited (distance: {h.edit_distance})</span>
                    )}
                    {h.rejection_reason && (
                      <span className="text-[10px] text-[var(--danger)]">"{h.rejection_reason}"</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {/* ── LEARNING INSIGHTS ── */}
      {activeTab === 'learning_insights' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['all', 'sub_performance', 'client_behavior', 'project_financials', 'agent_performance', 'workflow_pattern', 'improvement_signal'].map(type => (
              <button
                key={type}
                onClick={() => setInsightFilter(type)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  insightFilter === type ? 'bg-[var(--navy)] text-white' : 'bg-[var(--border-light)] text-[var(--text-secondary)]'
                )}
              >
                {type === 'all' ? 'All' : type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredInsights.length === 0 ? (
              <Card>
                <p className="text-center text-sm text-[var(--text-tertiary)] py-4">No insights yet. The meta agent generates these weekly from your data.</p>
              </Card>
            ) : (
              filteredInsights.map(insight => (
                <Card key={insight.id}>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full', INSIGHT_TYPE_COLORS[insight.insight_type] ?? 'bg-gray-100 text-gray-600')}>
                          {insight.insight_type.replace(/_/g, ' ')}
                        </span>
                        {insight.actioned && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--success-bg)] text-[var(--success)] flex items-center gap-0.5">
                            <Check size={9} /> Actioned
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[var(--text)] mb-1">{insight.title}</p>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{insight.insight}</p>
                      {insight.evidence && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-1.5 italic">Evidence: {insight.evidence}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${insight.confidence * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{(insight.confidence * 100).toFixed(0)}% conf</span>
                      <p className="text-[11px] text-[var(--text-tertiary)]">· {insight.generated_at}</p>
                    </div>
                    {!insight.actioned && (
                      <button
                        onClick={() => markInsightActioned(insight.id)}
                        className="text-xs font-semibold text-[var(--success)] underline underline-offset-2"
                      >
                        Mark actioned
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
