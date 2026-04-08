import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Mail, Check, Flag, AlertCircle, ChevronRight, Mic, Sparkles, Star, Image as ImageIcon, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import {
  MOCK_PROJECTS, MOCK_PHASES, MOCK_EXPENSES, MOCK_INVOICES, MOCK_TASKS, MOCK_DAILY_LOGS,
  MOCK_CHANGE_ORDERS, MOCK_PUNCH_LIST, MOCK_BUDGET_SETTINGS, MOCK_BUDGET_TRADES, MOCK_TIME_ENTRIES,
  MOCK_WARRANTY_CLAIMS_FULL, MOCK_COMM_LOG, MOCK_PORTFOLIO_PHOTOS, MOCK_PROJECT_REELS, MOCK_INSPECTION_REPORTS,
} from '@/data/mock'
import { cn } from '@/lib/utils'
import { BudgetTab } from './budget/BudgetTab'
import { ProjectSubsTab } from './ProjectSubsTab'
import { EditableDeliverable } from '@/components/ui/EditableDeliverable'
import type { EditableItem } from '@/components/ui/EditableDeliverable'

type Tab = 'overview' | 'financials' | 'budget' | 'subs' | 'tasks' | 'logs' | 'changes' | 'punch' | 'warranty' | 'comms' | 'photos'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')

  const project = MOCK_PROJECTS.find(p => p.id === id)
  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Project not found.</p>
      </div>
    )
  }

  const phases = MOCK_PHASES[id ?? ''] ?? []
  const expenses = MOCK_EXPENSES.filter(e => e.project_id === id)
  const invoices = MOCK_INVOICES.filter(i => i.project_id === id)
  const tasks = MOCK_TASKS.filter(t => t.project_id === id)
  const logs = MOCK_DAILY_LOGS.filter(l => l.project_id === id)
  const changeOrders = MOCK_CHANGE_ORDERS.filter(co => co.project_id === id)
  const punchList = MOCK_PUNCH_LIST.filter(pl => pl.project_id === id)
  const warrantyClaims = MOCK_WARRANTY_CLAIMS_FULL.filter((w) => w.project_id === id)
  const commEntries = MOCK_COMM_LOG.filter((c) => c.project_id === id)
  const projectPhotos = MOCK_PORTFOLIO_PHOTOS.filter((p) => p.project_id === id)
  const projectReel = MOCK_PROJECT_REELS.find((r) => r.project_id === id)
  const projectInspections = MOCK_INSPECTION_REPORTS.filter((i) => i.project_id === id)

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const invoiceTotal = invoices.reduce((s, i) => s + i.total, 0)
  const margin = project.contract_value > 0 ? (project.contract_value - expenseTotal) / project.contract_value : null

  const isBudgetProject = project.project_type === 'addition' || project.project_type === 'large_remodel'
  const budgetSettings  = MOCK_BUDGET_SETTINGS[project.id]
  const budgetTrades    = MOCK_BUDGET_TRADES.filter(t => t.project_id === project.id)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'financials', label: 'Financials' },
    ...(isBudgetProject ? [{ id: 'budget' as Tab, label: 'Budget' }] : []),
    ...(isBudgetProject ? [{ id: 'subs' as Tab, label: 'Subs' }] : []),
    { id: 'photos',     label: `Photos${projectPhotos.length ? ` (${projectPhotos.length})` : ''}` },
    { id: 'tasks',      label: `Tasks${tasks.length ? ` (${tasks.filter(t=>t.status!=='done').length})` : ''}` },
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
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-mono text-lg font-bold text-[var(--text)]">${(project.contract_value/1000).toFixed(0)}K</p>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Client</p>
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
                        {phase.status === 'active' && phase.pct > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${phase.pct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{phase.pct}%</span>
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

        {/* ── BUDGET ── */}
        {tab === 'budget' && (
          <BudgetTab projectId={project.id} projectType={project.project_type} />
        )}

        {/* ── SUBS (Phase H) ── */}
        {tab === 'subs' && (
          <ProjectSubsTab projectId={project.id} />
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
                  const projectEntries = MOCK_TIME_ENTRIES.filter(e => e.project_id === project?.id && e.clock_out !== null)
                  if (projectEntries.length === 0) return (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-[var(--text-tertiary)]">No labor logged yet</p>
                    </div>
                  )
                  const totalHrs = projectEntries.reduce((s, e) => s + (e.total_minutes ?? 0), 0) / 60
                  const billedTotal = projectEntries.filter(e => e.is_billable).reduce((s, e) => s + (e.billed_amount ?? 0), 0)
                  const pendingTotal = projectEntries.filter(e => e.is_billable && e.billing_status === 'pending').reduce((s, e) => s + (e.billed_amount ?? 0), 0)
                  return (
                    <>
                      {projectEntries.map(e => (
                        <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center border-t border-[var(--border-light)]">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">{USER_NAMES[e.user_id] ?? e.user_id}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{WORK_LABELS[e.work_type] ?? e.work_type}</p>
                          </div>
                          <p className="font-mono text-sm text-[var(--text)] w-14 text-right">{((e.total_minutes ?? 0)/60).toFixed(1)}h</p>
                          <p className="font-mono text-sm text-[var(--text)] w-20 text-right">${(e.billed_amount ?? 0).toFixed(0)}</p>
                          <div className="w-16 flex justify-end">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              e.billing_status === 'invoiced' ? 'bg-[var(--success-bg)] text-[var(--success)]' :
                              e.billing_status === 'pending' ? 'bg-[var(--warning-bg)] text-[var(--warning)]' :
                              'bg-[var(--bg)] text-[var(--text-tertiary)]'
                            }`}>{e.billing_status === 'na' ? 'N/A' : e.billing_status}</span>
                          </div>
                        </div>
                      ))}
                      {/* Totals footer */}
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 bg-[var(--bg)] border-t border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--text)]">Total</p>
                        <p className="font-mono text-sm font-bold text-[var(--text)] w-14 text-right">{totalHrs.toFixed(1)}h</p>
                        <p className="font-mono text-sm font-bold text-[var(--success)] w-20 text-right">${billedTotal.toFixed(0)}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] w-16 text-right">${pendingTotal.toFixed(0)} pend.</p>
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
              logs.map(log => (
                <Card key={log.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-semibold text-sm text-[var(--text)]">{log.date}</p>
                    <span className="text-xs text-[var(--text-tertiary)]">· {log.employee} · {log.weather}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{log.summary}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">{log.workers.join(', ')}</p>
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
              changeOrders.map(co => (
                <div key={co.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Flag size={14} className="text-[var(--rust)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm text-[var(--text)]">{co.title}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{co.description}</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">Flagged by {co.flagged_by} · {co.flagged_at}</p>
                      </div>
                    </div>
                    <StatusPill status={co.status} />
                  </div>
                  {co.cost_change !== 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <AlertCircle size={12} className="text-[var(--warning)]" />
                      <p className="text-xs text-[var(--warning)]">
                        +${co.cost_change.toLocaleString()} cost change
                        {co.schedule_change_days > 0 && ` · +${co.schedule_change_days} days`}
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
              <Button size="sm">
                <Sparkles size={13} />
                Generate progress reel
              </Button>
            </div>
            {projectReel && (
              <Card>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                  Progress reel
                </p>
                <p className="text-sm text-[var(--text)]">
                  {projectReel.photo_count} photos · generated {projectReel.generated_at.split('T')[0]}
                </p>
                <a
                  href={`/gallery/${projectReel.gallery_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--navy)] font-semibold mt-2 inline-block"
                >
                  Open shareable gallery →
                </a>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-3">
              {projectPhotos.map((p) => (
                <Card key={p.id} padding="none">
                  <div className="aspect-[4/3] rounded-t-xl overflow-hidden bg-[var(--bg)] relative">
                    <img src={p.image_url} alt={p.caption} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5">
                      <Star size={12} className={p.featured ? 'text-[var(--rust)] fill-[var(--rust)]' : 'text-[var(--text-tertiary)]'} />
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{p.caption}</p>
                    <button className="text-[10px] text-[var(--navy)] font-semibold mt-1.5">
                      <ImageIcon size={10} className="inline mr-1" />
                      In portfolio
                    </button>
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Unified communication timeline
              </p>
              <Button size="sm">
                <Mic size={13} />
                Log conversation
              </Button>
            </div>
            <Card padding="none">
              {commEntries.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No communication yet</div>
              ) : (
                commEntries.map((c) => (
                  <div key={c.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        c.comm_type === 'logged_conversation' ? 'bg-[var(--rust-subtle)] text-[var(--rust)]' :
                        c.comm_type === 'sms' ? 'bg-blue-100 text-blue-700' :
                        'bg-[var(--bg)] text-[var(--text-tertiary)]'
                      }`}>
                        {c.comm_type === 'logged_conversation' ? 'Logged' : c.comm_type}
                      </span>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {c.participant_name} · {c.date.split('T')[0]}
                      </p>
                      {c.has_audio && <Mic size={11} className="text-[var(--text-tertiary)]" />}
                    </div>
                    <p className="text-sm text-[var(--text)] leading-relaxed">{c.summary}</p>
                    {c.action_items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {c.action_items.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <div className={`w-3 h-3 rounded border ${a.done ? 'bg-[var(--success)] border-[var(--success)]' : 'border-[var(--border)]'}`}>
                              {a.done && <Check size={10} className="text-white" />}
                            </div>
                            <p className={a.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-secondary)]'}>
                              {a.task}
                              {a.due_date && <span className="text-[var(--text-tertiary)]"> · {a.due_date}</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.client_sentiment && (
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 italic">
                        Sentiment: {c.client_sentiment}
                      </p>
                    )}
                  </div>
                ))
              )}
            </Card>
          </div>
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
                warrantyClaims.map((c) => (
                  <div key={c.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[10px] text-[var(--text-tertiary)]">{c.claim_number}</p>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        c.status === 'resolved' ? 'bg-[var(--success-bg)] text-[var(--success)]' :
                        c.status === 'scheduled' ? 'bg-[var(--warning-bg)] text-[var(--warning)]' :
                        'bg-[var(--bg)] text-[var(--text-tertiary)]'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text)] mt-1">{c.description}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      {c.area} · reported {c.reported_at}
                    </p>
                    {c.actual_repair_cost != null && (
                      <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
                        Repair cost: <span className="font-mono">${c.actual_repair_cost}</span>
                      </p>
                    )}
                    {c.resolution && (
                      <p className="text-[11px] text-[var(--text-secondary)] italic mt-1">{c.resolution}</p>
                    )}
                  </div>
                ))
              )}
            </Card>

            {projectInspections.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] pt-3">
                  Inspection reports
                </p>
                <Card padding="none">
                  {projectInspections.map((i) => (
                    <div key={i.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text)] capitalize">
                          {i.inspection_type.replace('_', ' ')}
                        </p>
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          i.overall_condition === 'ready_to_proceed' ? 'bg-[var(--success-bg)] text-[var(--success)]' :
                          i.overall_condition === 'minor_issues' ? 'bg-[var(--warning-bg)] text-[var(--warning)]' :
                          'bg-[var(--danger-bg)] text-[var(--danger)]'
                        }`}>
                          {i.overall_condition.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        {i.area_count} areas · {i.conducted_at.split('T')[0]} · {i.conducted_by_name}
                      </p>
                      {i.ai_summary && (
                        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 italic">{i.ai_summary}</p>
                      )}
                    </div>
                  ))}
                </Card>
              </>
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
                items={punchList.map((item): EditableItem => ({
                  id: item.id,
                  title: item.description,
                  description: [item.location, item.assigned_to].filter(Boolean).join(' · '),
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
