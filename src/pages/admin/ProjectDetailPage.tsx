import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Mail, Check, Flag, AlertCircle, ChevronRight, Mic, Sparkles, Star, Image as ImageIcon, ShieldCheck, Plus, Loader2, ArrowDownLeft, ArrowUpRight, MessageCircle, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { BudgetTab } from './budget/BudgetTab'
import { ProjectSubsTab } from './ProjectSubsTab'
import { ProjectTeamTab } from './ProjectTeamTab'
import { EditableDeliverable } from '@/components/ui/EditableDeliverable'
import type { EditableItem } from '@/components/ui/EditableDeliverable'
import { useProjectRealtime } from '@/hooks/useProjectRealtime'
import { ProjectActivityFeed } from '@/components/project/ProjectActivityFeed'
import { ProjectPresenceBar } from '@/components/project/ProjectPresenceBar'
import { ClientShareToggle } from '@/components/project/ClientShareToggle'
import { ProjectSuggestionInbox } from '@/components/project/ProjectSuggestionInbox'
import { InviteClientToPortal } from '@/components/project/InviteClientToPortal'

type Tab = 'overview' | 'activity' | 'financials' | 'budget' | 'subs' | 'team' | 'tasks' | 'logs' | 'changes' | 'punch' | 'warranty' | 'comms' | 'photos'

interface CommLogEntry {
  id: string
  project_id: string | null
  direction: 'inbound' | 'outbound' | 'internal' | null
  channel: 'email' | 'sms' | 'phone' | 'in_app' | 'meeting' | 'other' | null
  comm_type: string | null
  party_name: string | null
  party_type: string | null
  summary: string | null
  body: string | null
  logged_by: string | null
  logged_via: string | null
  occurred_at: string
  created_at: string
}

function commDateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date()
  y.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, y)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function commRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function commChannelIcon(channel: string | null) {
  if (channel === 'email') return Mail
  if (channel === 'sms' || channel === 'in_app') return MessageCircle
  if (channel === 'phone') return Phone
  if (channel === 'meeting') return Users
  return MessageCircle
}

function commDirectionIcon(direction: string | null) {
  if (direction === 'inbound') return ArrowDownLeft
  if (direction === 'outbound') return ArrowUpRight
  return Users
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const canShareWithClient = user?.role === 'admin' || user?.role === 'super_admin'

  // Comms tab — local state for the "Log conversation" inline form.
  const [commFormOpen, setCommFormOpen] = useState(false)
  const [commChannel, setCommChannel] = useState<'email' | 'sms' | 'phone' | 'in_app' | 'meeting' | 'other'>('phone')
  const [commDirection, setCommDirection] = useState<'inbound' | 'outbound' | 'internal'>('inbound')
  const [commPartyName, setCommPartyName] = useState('')
  const [commPartyType, setCommPartyType] = useState<'client' | 'subcontractor' | 'supplier' | 'inspector' | 'team' | 'other'>('client')
  const [commSummary, setCommSummary] = useState('')

  // Live-update the whole page when anyone on the team makes a change.
  useProjectRealtime(id)

  const { data: project, isLoading: projectLoading, error: projectError, refetch: projectRefetch } = useQuery({
    queryKey: ['project', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: phases = [] } = useQuery({
    queryKey: ['project_phases', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_phases').select('*').eq('project_id', id).order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['project_expenses', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').eq('project_id', id).order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['project_invoices', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('project_id', id)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['project_tasks', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('project_id', id).order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['project_daily_logs', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['project_change_orders', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('change_orders').select('*').eq('project_id', id)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: punchList = [] } = useQuery({
    queryKey: ['project_punch_list', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('punch_list_items').select('*').eq('project_id', id).order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: warrantyClaims = [] } = useQuery({
    queryKey: ['project_warranty_claims', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('warranty_claims').select('*').eq('project_id', id)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: projectPhotos = [] } = useQuery({
    queryKey: ['project_photos', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_photos').select('*').eq('project_id', id).order('taken_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  // PR 17: real comms timeline from communication_log.
  const { data: commEntries = [] } = useQuery({
    queryKey: ['project_comm_log', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_log')
        .select('id, project_id, direction, channel, comm_type, party_name, party_type, summary, body, logged_by, logged_via, occurred_at, created_at')
        .eq('project_id', id)
        .order('occurred_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as CommLogEntry[]
    },
  })

  const logCommMutation = useMutation({
    mutationFn: async () => {
      if (!id || !user?.id) throw new Error('Missing project or user')
      const summaryTrimmed = commSummary.trim()
      if (!summaryTrimmed) throw new Error('Summary required')
      const { error } = await supabase.from('communication_log').insert({
        project_id: id,
        direction: commDirection,
        channel: commChannel,
        comm_type: commChannel === 'sms' ? 'sms' : commChannel === 'email' ? 'email' : commChannel === 'meeting' ? 'meeting' : 'call',
        party_name: commPartyName.trim() || null,
        party_type: commPartyType,
        summary: summaryTrimmed,
        logged_by: user.id,
        logged_via: 'manual',
        occurred_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_comm_log', id] })
      setCommFormOpen(false)
      setCommPartyName('')
      setCommSummary('')
    },
  })

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['project_time_entries', id, user?.company_id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('time_entries').select('*').eq('project_id', id).not('clock_out', 'is', null)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: assignmentCount = 0 } = useQuery({
    queryKey: ['project_assignments_count', id],
    enabled: !!id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('project_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', id)
        .eq('active', true)
      if (error) throw error
      return count ?? 0
    },
  })

  // PR 19: progress reels generated for this project.
  const { data: reels = [], refetch: reelsRefetch } = useQuery({
    queryKey: ['project_reels', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_reels')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        title: string | null
        manifest: { photos: Array<{ url: string; caption: string | null; taken_at: string | null; category: string | null }> } | null
        narrative: string | null
        visible_to_client: boolean
        created_at: string
      }>
    },
  })

  // PR 19: inspection reports for this project.
  const { data: inspectionReports = [], refetch: inspectionsRefetch } = useQuery({
    queryKey: ['inspection_reports', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_reports')
        .select('*')
        .eq('project_id', id)
        .order('inspection_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        project_id: string
        inspection_type: string
        inspector_name: string | null
        inspector_org: string | null
        inspection_date: string
        result: 'pass' | 'fail' | 'conditional' | 'pending'
        notes: string | null
        photos: string[] | null
        follow_up_required: boolean
        follow_up_notes: string | null
        created_at: string
      }>
    },
  })

  // PR 19: reel generation + inspection form state.
  const [generatingReel, setGeneratingReel] = useState(false)
  const [reelError, setReelError] = useState<string | null>(null)
  const [showInspectionForm, setShowInspectionForm] = useState(false)
  const [inspectionSaving, setInspectionSaving] = useState(false)

  async function handleGenerateReel() {
    if (!id) return
    setReelError(null)
    setGeneratingReel(true)
    try {
      const { error } = await supabase.functions.invoke('generate-progress-reel', {
        body: { project_id: id },
      })
      if (error) throw error
      await reelsRefetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setReelError(msg)
    } finally {
      setGeneratingReel(false)
    }
  }

  async function handleReelVisibilityToggle(reelId: string, next: boolean) {
    const { error } = await supabase.from('project_reels').update({ visible_to_client: next }).eq('id', reelId)
    if (error) {
      alert('Could not update visibility: ' + error.message)
      return
    }
    reelsRefetch()
  }

  if (projectLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-tertiary)]">Loading project…</p>
      </div>
    )
  }

  if (projectError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load project. Check your connection and try again.</p>
      <button onClick={() => projectRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Project not found.</p>
      </div>
    )
  }

  const expenseTotal = (expenses as Array<{ amount: number }>).reduce((s, e) => s + e.amount, 0)
  const invoiceTotal = (invoices as Array<{ total: number }>).reduce((s, i) => s + i.total, 0)
  const margin = project.contract_value > 0 ? (project.contract_value - expenseTotal) / project.contract_value : null

  const isBudgetProject = project.project_type === 'addition' || project.project_type === 'large_remodel'
  const budgetSettings  = null as Record<string, number> | null
  const budgetTrades    = [] as Array<{ is_locked: boolean; awarded_amount?: number }>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'activity',   label: 'Activity' },
    { id: 'team',       label: `Team${assignmentCount ? ` (${assignmentCount})` : ''}` },
    { id: 'financials', label: 'Financials' },
    ...(isBudgetProject ? [{ id: 'budget' as Tab, label: 'Budget' }] : []),
    ...(isBudgetProject ? [{ id: 'subs' as Tab, label: 'Subs' }] : []),
    { id: 'photos',     label: `Photos${projectPhotos.length ? ` (${projectPhotos.length})` : ''}` },
    { id: 'tasks',      label: `Tasks${tasks.length ? ` (${(tasks as Array<{status: string}>).filter(t=>t.status!=='done').length})` : ''}` },
    { id: 'logs',       label: 'Logs' },
    { id: 'comms',      label: `Comms${commEntries.length ? ` (${commEntries.length})` : ''}` },
    { id: 'changes',    label: `Changes${changeOrders.length ? ` (${changeOrders.length})` : ''}` },
    { id: 'warranty',   label: `Warranty${warrantyClaims.length ? ` (${warrantyClaims.length})` : ''}` },
    { id: 'punch',      label: 'Punch' },
  ]

  return (
    <div className="max-w-2xl mx-auto lg:max-w-none">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 lg:px-8 lg:py-6 border-b border-[var(--border-light)]">
        <button
          onClick={() => navigate('/admin/projects')}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={15} />
          Projects
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-[var(--navy)] leading-tight">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusPill status={project.status} />
              <StatusPill status={project.schedule_status} />
              <span className="text-xs text-[var(--text-tertiary)] capitalize">{project.project_type}</span>
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
                title="This page updates live as your team makes changes"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--success)] opacity-60 animate-ping" />
                  <span className="relative rounded-full bg-[var(--success)] h-1.5 w-1.5" />
                </span>
                Live
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {id && <ProjectPresenceBar projectId={id} />}
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-[var(--text)]">${(project.contract_value/1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {project.status === 'active' && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${project.percent_complete}%` }} />
            </div>
            <span className="text-xs font-mono text-[var(--text-tertiary)]">{project.percent_complete}%</span>
          </div>
        )}
      </div>

      {/* AI Suggestion Inbox — renders nothing when there are no pending rows */}
      {canShareWithClient && id && (
        <div className="px-4 pt-3 lg:px-8">
          <ProjectSuggestionInbox projectId={id} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border-light)] px-4 lg:px-8">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all',
              tab === t.id
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 lg:px-8 lg:py-6">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            {/* Client */}
            <Card>
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Client</p>
                {canShareWithClient && id && (
                  <InviteClientToPortal
                    projectId={id}
                    clientUserId={project.client_user_id ?? null}
                    clientName={project.client_name ?? null}
                    clientEmail={project.client_email ?? null}
                    onInvited={() => projectRefetch()}
                  />
                )}
              </div>
              <p className="font-semibold text-[var(--text)]">{project.client_name}</p>
              <div className="space-y-2 mt-3">
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  <p className="text-sm text-[var(--text-secondary)]">{project.client_phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  <p className="text-sm text-[var(--text-secondary)]">{project.client_email}</p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[var(--text-secondary)]">{project.address}</p>
                </div>
              </div>
            </Card>

            {/* Phases */}
            {phases.length > 0 && (
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">Phases</p>
                <div className="space-y-3">
                  {phases.map((phase, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                        phase.status === 'complete' ? 'bg-[var(--success)]' :
                        phase.status === 'active' ? 'bg-[var(--navy)]' :
                        'bg-[var(--border-light)]'
                      )}>
                        {phase.status === 'complete' && <Check size={12} className="text-white" />}
                        {phase.status === 'active' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', phase.status === 'upcoming' ? 'text-[var(--text-tertiary)]' : 'font-medium text-[var(--text)]')}>
                          {phase.name}
                        </p>
                        {phase.status === 'active' && (phase.percent_complete ?? 0) > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${phase.percent_complete ?? 0}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{phase.percent_complete ?? 0}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Budget Health card (addition / large_remodel only) */}
            {isBudgetProject && budgetSettings && (() => {
              const totalSubCost     = budgetTrades.filter(t => t.is_locked).reduce((s, t) => s + (t.awarded_amount ?? 0), 0)
              const subMarkup        = totalSubCost * budgetSettings.sub_markup_percent
              const pmFee            = budgetSettings.duration_weeks * budgetSettings.pm_hours_per_week * budgetSettings.pm_rate_per_hour
              const crewBilled       = budgetSettings.crew_weeks_on_site * budgetSettings.crew_weekly_cost * budgetSettings.crew_bill_multiplier
              const crewCost         = budgetSettings.crew_weeks_on_site * budgetSettings.crew_weekly_cost
              const overheadAlloc    = (budgetSettings.duration_weeks / 4.33) * budgetSettings.monthly_overhead
              const contractPrice    = totalSubCost + subMarkup + crewBilled + pmFee + budgetSettings.contingency_amount
              const netProfit        = subMarkup + (crewBilled - crewCost) + pmFee + budgetSettings.contingency_amount - overheadAlloc
              const netMarginPct     = contractPrice > 0 ? netProfit / contractPrice : 0
              const marginColor      = netMarginPct >= 0.18 ? 'text-[var(--success)]' : netMarginPct >= 0.12 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
              return (
                <button
                  onClick={() => setTab('budget')}
                  className="w-full text-left"
                >
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Budget Health</p>
                      <div className="flex items-center gap-1 text-[var(--navy)] text-xs font-semibold">
                        Go to Budget <ChevronRight size={13} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Sub costs</p>
                        <p className="font-mono text-sm font-bold text-[var(--text)]">${(totalSubCost / 1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Proj. net</p>
                        <p className={`font-mono text-sm font-bold ${netProfit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          ${(Math.abs(netProfit) / 1000).toFixed(0)}K
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Net margin</p>
                        <p className={`font-mono text-sm font-bold ${marginColor}`}>{(netMarginPct * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </Card>
                </button>
              )
            })()}

            {/* Key dates */}
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Dates</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm text-[var(--text-secondary)]">Start date</p>
                  <p className="text-sm font-semibold text-[var(--text)]">{project.estimated_start_date}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-[var(--text-secondary)]">Target completion</p>
                  <p className="text-sm font-semibold text-[var(--text)]">{project.target_completion_date}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-[var(--text-secondary)]">Estimated duration</p>
                  <p className="text-sm font-semibold text-[var(--text)]">{project.estimated_duration_weeks} weeks</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-[var(--text-secondary)]">Warranty</p>
                  <p className="text-sm font-semibold text-[var(--text)]">{project.warranty_months} months</p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── ACTIVITY ── */}
        {tab === 'activity' && id && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Live project activity — every edit, log, and team change as it happens.
            </p>
            <ProjectActivityFeed projectId={id} />
          </div>
        )}

        {/* ── BUDGET ── */}
        {tab === 'budget' && (
          <BudgetTab projectId={project.id} projectType={project.project_type} />
        )}

        {/* ── SUBS (Phase H) ── */}
        {tab === 'subs' && (
          <ProjectSubsTab projectId={project.id} />
        )}

        {/* ── TEAM ── */}
        {tab === 'team' && (
          <ProjectTeamTab projectId={project.id} />
        )}

        {/* ── FINANCIALS ── */}
        {tab === 'financials' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Contract</p>
                <p className="font-display text-2xl text-[var(--navy)]">${(project.contract_value/1000).toFixed(0)}K</p>
              </div>
              <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Billed</p>
                <p className="font-display text-2xl text-[var(--text)]">${(invoiceTotal/1000).toFixed(0)}K</p>
              </div>
              <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Expenses</p>
                <p className="font-display text-2xl text-[var(--rust)]">${(expenseTotal/1000).toFixed(1)}K</p>
              </div>
              <div className="bg-[var(--white)] border border-[var(--border-light)] rounded-2xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Margin</p>
                <p className={`font-display text-2xl ${margin !== null && margin >= project.target_margin ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                  {margin !== null ? `${(margin*100).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>

            <SectionHeader title="Expenses" />
            <Card padding="none">
              {expenses.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No expenses recorded</div>
              ) : (
                expenses.map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)] truncate">{exp.description}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{exp.vendor} · {exp.date}</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] capitalize">{exp.category}</span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-[var(--text)] flex-shrink-0">${exp.amount.toLocaleString()}</p>
                  </div>
                ))
              )}
            </Card>

            <SectionHeader title="Invoices" />
            <Card padding="none">
              {invoices.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No invoices</div>
              ) : (
                invoices.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[var(--text)]">{inv.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{inv.invoice_number}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusPill status={inv.status} />
                      <p className="font-mono text-sm font-semibold text-[var(--text)]">${inv.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </Card>

            {/* Labor section */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Labor</p>
              <Card padding="none">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-[var(--bg)]">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Person / Type</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] w-14 text-right">Hours</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] w-20 text-right">Billed</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] w-16 text-right">Status</p>
                </div>
                {(() => {
                  const USER_NAMES: Record<string, string> = { 'admin-1': 'Adam', 'employee-1': 'Jeff', 'employee-2': 'Steven' }
                  const WORK_LABELS: Record<string, string> = { field_carpentry: 'Carpentry', project_management: 'PM', site_visit: 'Site Visit', design: 'Design', administrative: 'Admin', travel: 'Travel', other: 'Other' }
                  const projectEntries = timeEntries as Array<{ id: string; employee_id: string; work_type?: string; total_hours?: number; is_billable?: boolean }>
                  if (projectEntries.length === 0) return (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-[var(--text-tertiary)]">No labor logged yet</p>
                    </div>
                  )
                  const totalHrs = projectEntries.reduce((s, e) => s + (e.total_hours ?? 0), 0)
                  const billableEntries = projectEntries.filter(e => e.is_billable)
                  return (
                    <>
                      {projectEntries.map(e => (
                        <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center border-t border-[var(--border-light)]">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">{USER_NAMES[e.employee_id] ?? e.employee_id}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{WORK_LABELS[e.work_type ?? ''] ?? (e.work_type ?? '—')}</p>
                          </div>
                          <p className="font-mono text-sm text-[var(--text)] w-14 text-right">{(e.total_hours ?? 0).toFixed(1)}h</p>
                          <p className="font-mono text-sm text-[var(--text)] w-20 text-right">—</p>
                          <div className="w-16 flex justify-end">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              e.is_billable ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--bg)] text-[var(--text-tertiary)]'
                            }`}>{e.is_billable ? 'Billable' : 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                      {/* Totals footer */}
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 bg-[var(--bg)] border-t border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--text)]">Total</p>
                        <p className="font-mono text-sm font-bold text-[var(--text)] w-14 text-right">{totalHrs.toFixed(1)}h</p>
                        <p className="font-mono text-sm font-bold text-[var(--success)] w-20 text-right">{billableEntries.length} billable</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] w-16 text-right"></p>
                      </div>
                    </>
                  )
                })()}
              </Card>
            </div>
          </>
        )}

        {/* ── TASKS ── */}
        {tab === 'tasks' && (
          <Card padding="none">
            {tasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No tasks</div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                    task.status === 'done' ? 'bg-[var(--success)] border-[var(--success)]' :
                    task.status === 'in_progress' ? 'border-[var(--navy)]' :
                    'border-[var(--border)]'
                  )}>
                    {task.status === 'done' && <Check size={11} className="text-white" />}
                    {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-[var(--navy)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', task.status === 'done' ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text)]')}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{task.priority}</span>
                      {task.due_date && <p className="text-[11px] text-[var(--text-tertiary)]">Due {task.due_date}</p>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        )}

        {/* ── LOGS ── */}
        {tab === 'logs' && (
          <div className="space-y-3">
            {logs.length === 0 ? (
              <Card><p className="text-center text-sm text-[var(--text-tertiary)]">No logs yet</p></Card>
            ) : (
              (logs as Array<{ id: string; log_date: string; employee_id: string; weather?: string; summary: string; workers_on_site?: string[]; visible_to_client?: boolean }>).map(log => (
                <Card key={log.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-semibold text-sm text-[var(--text)] flex-1">{log.log_date}</p>
                    {log.weather && <span className="text-xs text-[var(--text-tertiary)]">· {log.weather}</span>}
                    {canShareWithClient && (
                      <ClientShareToggle
                        table="daily_logs"
                        rowId={log.id}
                        visible={log.visible_to_client ?? false}
                      />
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{log.summary}</p>
                  {log.workers_on_site && log.workers_on_site.length > 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">{log.workers_on_site.join(', ')}</p>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── CHANGE ORDERS ── */}
        {tab === 'changes' && (
          <Card padding="none">
            {changeOrders.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No change orders</div>
            ) : (
              (changeOrders as Array<{ id: string; title: string; description: string; flagged_at?: string; status: string; cost_change?: number; schedule_change_days?: number; visible_to_client?: boolean }>).map(co => (
                <div key={co.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Flag size={14} className="text-[var(--rust)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm text-[var(--text)]">{co.title}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{co.description}</p>
                        {co.flagged_at && <p className="text-xs text-[var(--text-tertiary)] mt-1">Flagged {co.flagged_at.split('T')[0]}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusPill status={co.status} />
                      {canShareWithClient && (
                        <ClientShareToggle
                          table="change_orders"
                          rowId={co.id}
                          visible={co.visible_to_client ?? false}
                        />
                      )}
                    </div>
                  </div>
                  {(co.cost_change ?? 0) !== 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <AlertCircle size={12} className="text-[var(--warning)]" />
                      <p className="text-xs text-[var(--warning)]">
                        +${(co.cost_change ?? 0).toLocaleString()} cost change
                        {(co.schedule_change_days ?? 0) > 0 && ` · +${co.schedule_change_days} days`}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>
        )}

        {/* ── PHOTOS ── */}
        {tab === 'photos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {projectPhotos.length} portfolio photo{projectPhotos.length === 1 ? '' : 's'}
              </p>
              <Button size="sm" onClick={handleGenerateReel} disabled={generatingReel}>
                <Sparkles size={13} />
                {generatingReel ? 'Generating…' : 'Generate progress reel'}
              </Button>
            </div>

            {/* PR 19: progress reel(s) — narrative + sequential photo strip */}
            {reelError && (
              <Card>
                <p className="text-sm text-[var(--warning)]">{reelError}</p>
              </Card>
            )}
            {reels.length > 0 && (
              <div className="space-y-3">
                {reels.map((r) => {
                  const photos = r.manifest?.photos ?? []
                  return (
                    <Card key={r.id}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[var(--text)]">{r.title ?? 'Progress reel'}</p>
                          <p className="text-[11px] text-[var(--text-tertiary)]">
                            Generated {new Date(r.created_at).toLocaleDateString()} · {photos.length} photo{photos.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        {canShareWithClient && (
                          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={r.visible_to_client}
                              onChange={(e) => handleReelVisibilityToggle(r.id, e.target.checked)}
                              className="rounded border-[var(--border)]"
                            />
                            Share with client
                          </label>
                        )}
                      </div>
                      {r.narrative && (
                        <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed mb-3">
                          {r.narrative}
                        </p>
                      )}
                      {photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 snap-x">
                          {photos.map((p, i) => (
                            <div key={`${r.id}-${i}`} className="flex-shrink-0 w-40 snap-start">
                              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[var(--bg)]">
                                <img src={p.url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
                              </div>
                              {p.caption && (
                                <p className="text-[10px] text-[var(--text-tertiary)] mt-1 line-clamp-2">{p.caption}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(projectPhotos as Array<{ id: string; image_url: string; caption?: string; category?: string; visible_to_client?: boolean }>).map((p) => (
                <Card key={p.id} padding="none">
                  <div className="aspect-[4/3] rounded-t-xl overflow-hidden bg-[var(--bg)] relative">
                    <img src={p.image_url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5">
                      <Star size={12} className="text-[var(--text-tertiary)]" />
                    </div>
                  </div>
                  <div className="p-2.5 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{p.caption}</p>
                      <button className="text-[10px] text-[var(--navy)] font-semibold mt-1.5">
                        <ImageIcon size={10} className="inline mr-1" />
                        In portfolio
                      </button>
                    </div>
                    {canShareWithClient && (
                      <ClientShareToggle
                        table="project_photos"
                        rowId={p.id}
                        visible={p.visible_to_client ?? false}
                      />
                    )}
                  </div>
                </Card>
              ))}
              {projectPhotos.length === 0 && (
                <Card>
                  <p className="text-center text-sm text-[var(--text-tertiary)] py-4">
                    No portfolio photos yet. Tag any project photo with "Add to portfolio".
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── COMMUNICATION LOG (timeline) ── */}
        {tab === 'comms' && (
          <CommsTab
            entries={commEntries}
            formOpen={commFormOpen}
            setFormOpen={setCommFormOpen}
            channel={commChannel}
            setChannel={setCommChannel}
            direction={commDirection}
            setDirection={setCommDirection}
            partyName={commPartyName}
            setPartyName={setCommPartyName}
            partyType={commPartyType}
            setPartyType={setCommPartyType}
            summary={commSummary}
            setSummary={setCommSummary}
            onSubmit={() => logCommMutation.mutate()}
            submitting={logCommMutation.isPending}
            errorMsg={logCommMutation.error instanceof Error ? logCommMutation.error.message : null}
          />
        )}

        {/* ── WARRANTY ── */}
        {tab === 'warranty' && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--success-bg)] flex items-center justify-center">
                  <ShieldCheck size={18} className="text-[var(--success)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {project.warranty_months}-month workmanship warranty
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Coverage runs from completion through {project.target_completion_date}
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Claims
              </p>
              <Button size="sm">
                <Flag size={13} />
                Log claim
              </Button>
            </div>

            <Card padding="none">
              {warrantyClaims.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No warranty claims</div>
              ) : (
                (warrantyClaims as Array<{ id: string; description: string; status: string; reported_at?: string; resolution?: string; visible_to_client?: boolean }>).map((c) => (
                  <div key={c.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        c.status === 'resolved' ? 'bg-[var(--success-bg)] text-[var(--success)]' :
                        c.status === 'scheduled' ? 'bg-[var(--warning-bg)] text-[var(--warning)]' :
                        'bg-[var(--bg)] text-[var(--text-tertiary)]'
                      }`}>
                        {c.status}
                      </span>
                      {canShareWithClient && (
                        <ClientShareToggle
                          table="warranty_claims"
                          rowId={c.id}
                          visible={c.visible_to_client ?? false}
                        />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[var(--text)] mt-1">{c.description}</p>
                    {c.reported_at && (
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Reported {c.reported_at.split('T')[0]}
                      </p>
                    )}
                    {c.resolution && (
                      <p className="text-[11px] text-[var(--text-secondary)] italic mt-1">{c.resolution}</p>
                    )}
                  </div>
                ))
              )}
            </Card>

            {/* PR 19: Inspection reports — building inspections (framing, electrical, final, etc.). */}
            {/* Photo attachments here will trigger agent-inspection-analyzer (wired via storage trigger, not here). */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Inspections ({inspectionReports.length})
              </p>
              <Button size="sm" onClick={() => setShowInspectionForm(true)}>
                <ShieldCheck size={13} />
                Log inspection
              </Button>
            </div>

            <Card padding="none">
              {inspectionReports.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
                  No inspections logged yet
                </div>
              ) : (
                inspectionReports.map((r) => {
                  const resultColor =
                    r.result === 'pass' ? 'bg-[var(--success-bg)] text-[var(--success)]' :
                    r.result === 'fail' ? 'bg-red-100 text-red-700' :
                    r.result === 'conditional' ? 'bg-[var(--warning-bg)] text-[var(--warning)]' :
                    'bg-[var(--bg)] text-[var(--text-tertiary)]'
                  const typeLabel = r.inspection_type
                    .split('_')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')
                  return (
                    <div key={r.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${resultColor}`}>
                            {r.result}
                          </span>
                          <p className="text-sm font-semibold text-[var(--text)]">{typeLabel}</p>
                          {r.follow_up_required && (
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
                              Follow-up
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
                          {r.inspection_date}
                        </p>
                      </div>
                      {(r.inspector_name || r.inspector_org) && (
                        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                          {[r.inspector_name, r.inspector_org].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-[11px] text-[var(--text-secondary)] mt-2 whitespace-pre-wrap">{r.notes}</p>
                      )}
                      {r.follow_up_required && r.follow_up_notes && (
                        <p className="text-[11px] text-[var(--warning)] mt-1 italic">Follow-up: {r.follow_up_notes}</p>
                      )}
                      {r.photos && r.photos.length > 0 && (
                        <div className="flex gap-2 mt-2 overflow-x-auto">
                          {r.photos.map((url, idx) => (
                            <a key={`${r.id}-p-${idx}`} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-[var(--bg)]">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </Card>

            {showInspectionForm && id && (
              <InspectionForm
                projectId={id}
                onClose={() => setShowInspectionForm(false)}
                onSaved={() => { setShowInspectionForm(false); inspectionsRefetch() }}
                userId={user?.id ?? null}
                saving={inspectionSaving}
                setSaving={setInspectionSaving}
              />
            )}
          </div>
        )}

        {/* ── PUNCH LIST ── */}
        {/* N38: Admin editing via EditableDeliverable. Client sign-off happens in ClientPunchList.tsx (read-only for clients). */}
        {tab === 'punch' && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Punch List Items</p>
            {punchList.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-2">Punch list is clear</p>
            ) : (
              <EditableDeliverable
                deliverableType="punch_list"
                instanceId={id ?? ''}
                instanceTable="projects"
                items={(punchList as Array<{ id: string; description: string; location?: string; status?: string }>).map((item): EditableItem => ({
                  id: item.id,
                  title: item.description,
                  description: item.location ?? '',
                }))}
                onSave={async () => {
                  // TODO: persist punch list edits to Supabase punch_list_items table
                }}
                isEditable={true}
                showPromoteOption={false}
              />
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CommsTab — PR 17: project-scoped timeline from communication_log + inline
// manual-entry form. Voice transcription via Mic is intentionally deferred
// to a future PR; only the text entry is wired here.
// ─────────────────────────────────────────────────────────────────────────────

interface CommsTabProps {
  entries: CommLogEntry[]
  formOpen: boolean
  setFormOpen: (v: boolean) => void
  channel: 'email' | 'sms' | 'phone' | 'in_app' | 'meeting' | 'other'
  setChannel: (v: 'email' | 'sms' | 'phone' | 'in_app' | 'meeting' | 'other') => void
  direction: 'inbound' | 'outbound' | 'internal'
  setDirection: (v: 'inbound' | 'outbound' | 'internal') => void
  partyName: string
  setPartyName: (v: string) => void
  partyType: 'client' | 'subcontractor' | 'supplier' | 'inspector' | 'team' | 'other'
  setPartyType: (v: 'client' | 'subcontractor' | 'supplier' | 'inspector' | 'team' | 'other') => void
  summary: string
  setSummary: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  errorMsg: string | null
}

function CommsTab(props: CommsTabProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, CommLogEntry[]>()
    for (const entry of props.entries) {
      const label = commDateLabel(entry.occurred_at)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(entry)
    }
    return Array.from(map.entries())
  }, [props.entries])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Unified communication timeline
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => props.setFormOpen(!props.formOpen)}>
            <Plus size={13} />
            {props.formOpen ? 'Cancel' : 'Log conversation'}
          </Button>
          <Button size="sm" title="Voice transcription coming soon" disabled>
            <Mic size={13} />
            Voice
          </Button>
        </div>
      </div>

      {props.formOpen && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text)] mb-3">New communication</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Channel</label>
              <select
                value={props.channel}
                onChange={e => props.setChannel(e.target.value as CommsTabProps['channel'])}
                className="mt-1 w-full text-sm px-2 py-2 rounded-lg border border-[var(--border)] bg-white"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="meeting">Meeting</option>
                <option value="in_app">In-app</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Direction</label>
              <select
                value={props.direction}
                onChange={e => props.setDirection(e.target.value as CommsTabProps['direction'])}
                className="mt-1 w-full text-sm px-2 py-2 rounded-lg border border-[var(--border)] bg-white"
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="internal">Internal</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Party name</label>
              <input
                type="text"
                value={props.partyName}
                onChange={e => props.setPartyName(e.target.value)}
                placeholder="e.g. Sarah Chen"
                className="mt-1 w-full text-sm px-2 py-2 rounded-lg border border-[var(--border)] bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Party type</label>
              <select
                value={props.partyType}
                onChange={e => props.setPartyType(e.target.value as CommsTabProps['partyType'])}
                className="mt-1 w-full text-sm px-2 py-2 rounded-lg border border-[var(--border)] bg-white"
              >
                <option value="client">Client</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="supplier">Supplier</option>
                <option value="inspector">Inspector</option>
                <option value="team">Team</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Summary</label>
            <textarea
              value={props.summary}
              onChange={e => props.setSummary(e.target.value)}
              placeholder="Short summary of what was discussed"
              rows={3}
              className="mt-1 w-full text-sm px-2 py-2 rounded-lg border border-[var(--border)] bg-white resize-y"
            />
          </div>
          {props.errorMsg && (
            <p className="mt-2 text-xs text-[var(--danger)]">{props.errorMsg}</p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => props.setFormOpen(false)}
              disabled={props.submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={props.onSubmit}
              disabled={props.submitting || props.summary.trim().length === 0}
            >
              {props.submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Log
            </Button>
          </div>
        </Card>
      )}

      {props.entries.length === 0 ? (
        <Card padding="none">
          <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No communication yet</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateLabel, entries]) => (
            <div key={dateLabel}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2 px-1">
                {dateLabel}
              </p>
              <Card padding="none">
                {entries.map((entry, idx) => {
                  const ChannelIcon = commChannelIcon(entry.channel ?? entry.comm_type)
                  const DirectionIcon = commDirectionIcon(entry.direction)
                  return (
                    <div
                      key={entry.id}
                      className={`p-4 ${idx < entries.length - 1 ? 'border-b border-[var(--border-light)]' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                          <ChannelIcon size={14} className="text-[var(--navy)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <DirectionIcon size={12} className="text-[var(--text-tertiary)]" />
                            <p className="text-xs font-semibold text-[var(--text)] truncate">
                              {entry.party_name || (entry.party_type ? entry.party_type.replace(/_/g, ' ') : 'Unknown')}
                            </p>
                            {entry.party_type && (
                              <span className="text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--cream-light)] px-2 py-0.5 rounded-full">
                                {entry.party_type}
                              </span>
                            )}
                            {entry.logged_via === 'ai' && (
                              <span className="text-[10px] font-medium text-[var(--navy)] bg-[var(--cream-light)] px-2 py-0.5 rounded-full">
                                AI
                              </span>
                            )}
                            <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                              {commRelativeTime(entry.occurred_at)}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] break-words">
                            {entry.summary || entry.body || '(no summary)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// PR 19: Inspection log form. Lives here (not a separate file) so it can share
// the page's supabase client + query invalidation callbacks directly.

const INSPECTION_TYPES = [
  'foundation',
  'framing',
  'electrical_rough',
  'plumbing_rough',
  'insulation',
  'final',
  'other',
]

const INSPECTION_RESULTS: Array<'pending' | 'pass' | 'fail' | 'conditional'> = [
  'pending', 'pass', 'conditional', 'fail',
]

function InspectionForm({
  projectId,
  onClose,
  onSaved,
  userId,
  saving,
  setSaving,
}: {
  projectId: string
  onClose: () => void
  onSaved: () => void
  userId: string | null
  saving: boolean
  setSaving: (v: boolean) => void
}) {
  const [followUp, setFollowUp] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-[var(--navy)]">Log Inspection</h2>
          <button onClick={onClose} className="p-1 text-[var(--text-tertiary)]">
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const inspectionType = (fd.get('inspection_type') as string) || 'other'
            const customType = (fd.get('other_type') as string)?.trim()
            const finalType = inspectionType === 'other' && customType ? customType : inspectionType
            const inspectionDate = fd.get('inspection_date') as string
            if (!inspectionDate) {
              alert('Inspection date is required')
              return
            }
            setSaving(true)
            try {
              // Upload photos first (if any) — same pattern as PhotosPage uses.
              const fileInput = (e.currentTarget.elements.namedItem('photos') as HTMLInputElement | null)
              const files = fileInput?.files ? Array.from(fileInput.files) : []
              const uploadedUrls: string[] = []
              for (const file of files) {
                const ext = file.name.split('.').pop() ?? 'jpg'
                const path = `inspections/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
                const { error: uploadErr } = await supabase.storage
                  .from('project-photos')
                  .upload(path, file, { contentType: file.type })
                if (uploadErr) throw uploadErr
                const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(path)
                uploadedUrls.push(urlData.publicUrl)
              }

              const { error: insertErr } = await supabase.from('inspection_reports').insert({
                project_id: projectId,
                inspection_type: finalType,
                inspector_name: (fd.get('inspector_name') as string)?.trim() || null,
                inspector_org: (fd.get('inspector_org') as string)?.trim() || null,
                inspection_date: inspectionDate,
                result: (fd.get('result') as string) || 'pending',
                notes: (fd.get('notes') as string)?.trim() || null,
                photos: uploadedUrls,
                follow_up_required: fd.get('follow_up_required') === 'on',
                follow_up_notes: (fd.get('follow_up_notes') as string)?.trim() || null,
                created_by: userId,
              })
              if (insertErr) throw insertErr
              onSaved()
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              alert('Could not save inspection: ' + msg)
            } finally {
              setSaving(false)
            }
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Type *</label>
              <select name="inspection_type" required className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20">
                {INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Date *</label>
              <input
                name="inspection_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Custom type (if "Other")</label>
            <input name="other_type" placeholder="e.g. occupancy, fire marshal" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Inspector</label>
              <input name="inspector_name" placeholder="Jane Smith" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Organization</label>
              <input name="inspector_org" placeholder="City Building Dept" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Result *</label>
            <select name="result" defaultValue="pending" required className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20">
              {INSPECTION_RESULTS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
            <textarea name="notes" rows={3} placeholder="Inspector findings, corrections required, etc." className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Photos</label>
            <input name="photos" type="file" accept="image/*" multiple className="w-full text-sm" />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Uploaded to the project-photos bucket.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <input type="checkbox" name="follow_up_required" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="rounded border-[var(--border)]" />
            Follow-up required
          </label>
          {followUp && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Follow-up notes</label>
              <textarea name="follow_up_notes" rows={2} placeholder="What needs to happen before re-inspection" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
            <Button type="submit" fullWidth disabled={saving}>{saving ? 'Saving…' : 'Log Inspection'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
