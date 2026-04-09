import { useMemo, useState } from 'react'
import { Shield, AlertTriangle, Check, Sparkles, Upload, ExternalLink, Clock } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ComplianceItem, CompliancePriority, ComplianceCategory } from '@/data/mock'
import { cn } from '@/lib/utils'

const PRIORITY_CONFIG: Record<CompliancePriority, { label: string; bg: string; text: string; dot: string }> = {
  critical: { label: 'Critical', bg: 'bg-[var(--danger-bg)]', text: 'text-[var(--danger)]', dot: 'bg-[var(--danger)]' },
  high:     { label: 'High',     bg: 'bg-[var(--warning-bg)]',text: 'text-[var(--warning)]',dot: 'bg-[var(--warning)]' },
  medium:   { label: 'Medium',   bg: 'bg-blue-50',            text: 'text-blue-600',         dot: 'bg-blue-500' },
  low:      { label: 'Low',      bg: 'bg-gray-50',            text: 'text-[var(--text-tertiary)]', dot: 'bg-[var(--text-tertiary)]' },
}

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  business_registration: 'Business Registration',
  licensing: 'Licensing',
  insurance: 'Insurance',
  tax: 'Tax',
  employment: 'Employment',
  safety: 'Safety',
  bonding: 'Bonding',
  permits: 'Permits',
  banking: 'Banking',
  contracts: 'Contracts',
  website_digital: 'Website & Digital',
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  not_started:    { label: 'Not Started', cls: 'bg-gray-100 text-[var(--text-tertiary)]' },
  in_progress:    { label: 'In Progress', cls: 'bg-blue-50 text-blue-600' },
  completed:      { label: 'Completed',    cls: 'bg-[var(--success-bg)] text-[var(--success)]' },
  not_applicable: { label: 'Not Applicable', cls: 'bg-gray-50 text-[var(--text-tertiary)]' },
  needs_renewal:  { label: 'Needs Renewal', cls: 'bg-[var(--warning-bg)] text-[var(--warning)]' },
}

type Filter = 'all' | 'critical' | 'high' | 'expiring'

export function CompliancePage() {
  const queryClient = useQueryClient()
  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['compliance-items'],
    queryFn: async () => {
      const { data } = await supabase.from('compliance_items').select('*').order('priority', { ascending: true })
      return (data ?? []) as ComplianceItem[]
    },
  })
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryFilter, setCategoryFilter] = useState<ComplianceCategory | 'all'>('all')

  const metrics = useMemo(() => {
    const criticalRemaining = items.filter((i) => i.priority === 'critical' && i.status !== 'completed' && i.status !== 'not_applicable').length
    const expiringSoon = items.filter((i) => {
      if (!i.expiry_date) return false
      const days = Math.floor((new Date(i.expiry_date).getTime() - Date.now()) / 86400000)
      return days >= 0 && days <= 60 && i.status !== 'not_applicable'
    }).length
    const completed = items.filter((i) => i.status === 'completed').length
    const applicable = items.filter((i) => i.status !== 'not_applicable').length
    const percent = applicable > 0 ? Math.round((completed / applicable) * 100) : 0
    return { criticalRemaining, expiringSoon, completed, percent }
  }, [items])

  const filtered = useMemo(() => {
    let list = [...items]
    if (filter === 'critical') list = list.filter((i) => i.priority === 'critical')
    if (filter === 'high') list = list.filter((i) => i.priority === 'high' || i.priority === 'critical')
    if (filter === 'expiring') {
      list = list.filter((i) => {
        if (!i.expiry_date) return false
        const days = Math.floor((new Date(i.expiry_date).getTime() - Date.now()) / 86400000)
        return days >= 0 && days <= 60 && i.status !== 'not_applicable'
      })
    }
    if (categoryFilter !== 'all') list = list.filter((i) => i.category === categoryFilter)
    return list
  }, [items, filter, categoryFilter])

  const expiring = useMemo(() => {
    return items
      .filter((i) => {
        if (!i.expiry_date) return false
        const days = Math.floor((new Date(i.expiry_date).getTime() - Date.now()) / 86400000)
        return days >= 0 && days <= 60 && i.status !== 'not_applicable'
      })
      .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  }, [items])

  const categoryProgress = useMemo(() => {
    const cats: Record<string, { total: number; done: number; criticalOpen: number }> = {}
    for (const i of items) {
      if (i.status === 'not_applicable') continue
      if (!cats[i.category]) cats[i.category] = { total: 0, done: 0, criticalOpen: 0 }
      cats[i.category].total += 1
      if (i.status === 'completed') cats[i.category].done += 1
      if (i.priority === 'critical' && i.status !== 'completed') cats[i.category].criticalOpen += 1
    }
    return cats
  }, [items])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('compliance_items').update({ status }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['compliance-items'] })
  }

  const handleMarkComplete = (item: ComplianceItem) => {
    const num = prompt(`Mark "${item.title}" as complete. Enter account/policy/license number (optional):`)
    updateStatus(item.id, 'completed')
    if (num) {
      supabase.from('compliance_items').update({ account_number: num }).eq('id', item.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['compliance-items'] })
      })
    }
  }

  const handleAiHelp = (item: ComplianceItem) => {
    alert(`AI Command Bar would open with:\n\n"${item.ai_help_prompt}"`)
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:px-8 lg:py-6 max-w-2xl mx-auto lg:max-w-none space-y-4 pb-24">
        <PageHeader title="Compliance" subtitle="Loading..." />
        <div className="text-sm text-[var(--text-secondary)] text-center py-8">Loading compliance items...</div>
      </div>
    )
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load compliance. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 lg:px-8 lg:py-6 max-w-2xl mx-auto lg:max-w-none space-y-4 pb-24">
      <PageHeader
        title="Compliance"
        subtitle={`${metrics.percent}% complete, ${metrics.criticalRemaining} critical items need attention`}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Critical Open" value={metrics.criticalRemaining} subtitle={metrics.criticalRemaining > 0 ? 'Needs attention' : 'All clear'} />
        <MetricCard label="Expiring 60d" value={metrics.expiringSoon} subtitle={metrics.expiringSoon > 0 ? 'Renew soon' : 'None'} />
        <MetricCard label="Completed" value={metrics.completed} />
        <MetricCard label="Overall" value={`${metrics.percent}%`} />
      </div>

      {/* Expiring Soon Panel */}
      {expiring.length > 0 && (
        <Card className="bg-[var(--warning-bg)] border-[var(--warning)]/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-[var(--warning)]" />
            <SectionHeader title="Renewing Soon" />
          </div>
          <div className="space-y-2">
            {expiring.map((i) => {
              const days = Math.floor((new Date(i.expiry_date!).getTime() - Date.now()) / 86400000)
              return (
                <div key={i.id} className="flex justify-between items-center text-sm">
                  <span className="flex-1 min-w-0 truncate">{i.title}</span>
                  <span className={cn('ml-2 flex-shrink-0 font-medium', days <= 7 ? 'text-[var(--danger)]' : days <= 30 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]')}>
                    {days === 0 ? 'Today' : `${days}d`}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {([
          { id: 'all', label: 'All' },
          { id: 'critical', label: 'Critical' },
          { id: 'high', label: 'High' },
          { id: 'expiring', label: 'Expiring' },
        ] as const).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filter === opt.id
                ? 'bg-[var(--navy)] text-white'
                : 'bg-white border border-[var(--border)] text-[var(--text-secondary)]',
            )}
          >
            {opt.label}
          </button>
        ))}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ComplianceCategory | 'all')}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)]"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Category progress */}
      <Card>
        <SectionHeader title="By Category" />
        <div className="mt-3 space-y-2.5">
          {Object.entries(categoryProgress).map(([cat, prog]) => {
            const pct = prog.total > 0 ? (prog.done / prog.total) * 100 : 0
            const hasOpenCritical = prog.criticalOpen > 0
            return (
              <div key={cat} className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className={cn('font-medium', hasOpenCritical ? 'text-[var(--danger)]' : 'text-[var(--text)]')}>
                    {CATEGORY_LABELS[cat as ComplianceCategory] ?? cat}
                    {hasOpenCritical && ` · ${prog.criticalOpen} critical`}
                  </span>
                  <span className="font-mono text-[var(--text-secondary)]">{prog.done}/{prog.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--border-light)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', hasOpenCritical ? 'bg-[var(--danger)]' : 'bg-[var(--success)]')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Item list */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <ComplianceCard
            key={item.id}
            item={item}
            onMarkComplete={handleMarkComplete}
            onAiHelp={handleAiHelp}
          />
        ))}
        {filtered.length === 0 && (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No items match current filters.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

function ComplianceCard({
  item,
  onMarkComplete,
  onAiHelp,
}: {
  item: ComplianceItem
  onMarkComplete: (item: ComplianceItem) => void
  onAiHelp: (item: ComplianceItem) => void
}) {
  const pcfg = PRIORITY_CONFIG[item.priority]
  const scfg = STATUS_LABELS[item.status] ?? STATUS_LABELS.not_started
  const isCompleted = item.status === 'completed'
  const daysToExpiry = item.expiry_date
    ? Math.floor((new Date(item.expiry_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <Card className={cn(item.priority === 'critical' && item.status !== 'completed' && 'border-l-4 border-l-[var(--danger)]')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', pcfg.bg, pcfg.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', pcfg.dot)} />
              {pcfg.label}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--cream-light)] text-[var(--text-secondary)]">
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-[var(--text-tertiary)]">
              {item.jurisdiction.replace('_', ' ')}
            </span>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', scfg.cls)}>
              {scfg.label}
            </span>
          </div>
          <h3 className="font-medium text-[15px] text-[var(--text)]">{item.title}</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{item.description}</p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
            <span>Cost: {item.estimated_cost}</span>
            <span>Frequency: {item.frequency.replace('_', ' ')}</span>
            {daysToExpiry !== null && (
              <span className={cn(daysToExpiry <= 30 && 'text-[var(--warning)] font-medium', daysToExpiry <= 7 && 'text-[var(--danger)]')}>
                Expires in {daysToExpiry}d
              </span>
            )}
            {item.account_number && <span className="font-mono">#{item.account_number}</span>}
          </div>

          {item.where_to_go && item.where_to_go.startsWith('http') && (
            <a
              href={item.where_to_go}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-[var(--navy)] hover:underline"
            >
              <ExternalLink size={11} />
              {item.where_to_go.replace(/^https?:\/\//, '').slice(0, 40)}
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-light)]">
        <Button size="sm" variant="secondary" onClick={() => onAiHelp(item)} className="flex-1">
          <Sparkles size={13} />
          Get AI Help
        </Button>
        {!isCompleted && (
          <Button size="sm" onClick={() => onMarkComplete(item)} className="flex-1">
            <Check size={13} />
            Mark Complete
          </Button>
        )}
        {isCompleted && (
          <Button size="sm" variant="secondary" onClick={() => alert('Upload dialog')} className="flex-1">
            <Upload size={13} />
            Upload Doc
          </Button>
        )}
      </div>
    </Card>
  )
}

export function ComplianceStatusMini() {
  const { data: items = [] } = useQuery({
    queryKey: ['compliance-items'],
    queryFn: async () => {
      const { data } = await supabase.from('compliance_items').select('*').order('priority', { ascending: true })
      return (data ?? []) as ComplianceItem[]
    },
  })
  const critical = items.filter((i) => i.priority === 'critical' && i.status !== 'completed' && i.status !== 'not_applicable').length
  const expiring = items.filter((i) => {
    if (!i.expiry_date) return false
    const days = Math.floor((new Date(i.expiry_date).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 60 && i.status !== 'not_applicable'
  }).length
  const needsAttention = critical + expiring

  return (
    <Card className={cn(needsAttention > 0 && 'border-l-4 border-l-[var(--warning)]')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {needsAttention > 0 ? (
              <AlertTriangle size={16} className="text-[var(--warning)]" />
            ) : (
              <Shield size={16} className="text-[var(--success)]" />
            )}
            <SectionHeader title="Compliance Status" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {needsAttention > 0
              ? `${needsAttention} item${needsAttention === 1 ? '' : 's'} need${needsAttention === 1 ? 's' : ''} attention`
              : 'All compliance items on track'}
          </p>
          {critical > 0 && (
            <p className="text-xs text-[var(--danger)] mt-1 font-medium">{critical} critical open</p>
          )}
        </div>
      </div>
    </Card>
  )
}
