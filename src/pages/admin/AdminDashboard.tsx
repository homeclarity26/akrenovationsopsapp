import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ScanLine, FileText, Send, Sparkles, TrendingUp, AlertCircle, Clock, Image, ShieldCheck, Wrench, Plus } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { HealthMonitor } from '@/components/HealthMonitor'
import { Tooltip } from '@/components/ui/Tooltip'
import { FirstVisitWizard } from '@/components/onboarding/FirstVisitWizard'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

function greeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name.split(' ')[0]}.`
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const QUICK_ACTIONS = [
  { label: 'Site Walk',  icon: ScanLine,  color: 'bg-[var(--cream-light)]',  text: 'text-[var(--navy)]',    route: '/admin/walkthrough' },
  { label: 'Proposals',  icon: FileText,  color: 'bg-[var(--rust-subtle)]',   text: 'text-[var(--rust)]',    route: '/admin/proposals' },
  { label: 'Invoices',   icon: Send,      color: 'bg-[var(--success-bg)]',    text: 'text-[var(--success)]', route: '/admin/invoices' },
  { label: 'Time',       icon: Clock,     color: 'bg-[var(--warning-bg)]',    text: 'text-[var(--warning)]', route: '/employee/time' },
  { label: 'AI Command', icon: Sparkles,  color: 'bg-[var(--navy)]',          text: 'text-white',            route: '/admin/ai' },
]

export function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Live data queries
  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id,title,status,schedule_status,percent_complete,current_phase,contract_value,actual_cost,actual_margin,target_margin')
        .in('status', ['active', 'pending'])
        .order('status', { ascending: false })
      return data ?? []
    },
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id,title,invoice_number,status,total,balance_due,due_date')
        .not('status', 'eq', 'voided')
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  const { data: pendingTimeCount = 0 } = useQuery({
    queryKey: ['dashboard-pending-time'],
    queryFn: async () => {
      const { count } = await supabase
        .from('time_entries')
        .select('id', { count: 'exact', head: true })
        .eq('entry_method', 'manual')
        .is('approved_at', null)
      return count ?? 0
    },
  })

  const { data: pendingToolCount = 0 } = useQuery({
    queryKey: ['dashboard-tool-requests'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tool_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      return count ?? 0
    },
  })

  const { data: warrantyCount = 0 } = useQuery({
    queryKey: ['dashboard-warranty'],
    queryFn: async () => {
      const { count } = await supabase
        .from('warranty_claims')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("resolved","denied")')
      return count ?? 0
    },
  })

  const { data: portfolioCount = 0 } = useQuery({
    queryKey: ['dashboard-portfolio'],
    queryFn: async () => {
      const { count } = await supabase
        .from('project_photos')
        .select('id', { count: 'exact', head: true })
        .not('ai_tags', 'is', null)
      return count ?? 0
    },
  })

  // Derived metrics
  const activeProjects = projects.filter(p => p.status === 'active')
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')
  const atRiskProjects = projects.filter(p => p.schedule_status === 'at_risk' || p.schedule_status === 'behind')
  const outstandingAR = invoices
    .filter(i => ['sent', 'viewed', 'partial_paid', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + (i.balance_due ?? 0), 0)
  const avgMargin = activeProjects.length > 0
    ? activeProjects.filter(p => p.actual_margin).reduce((sum, p) => sum + (p.actual_margin ?? 0), 0) / activeProjects.filter(p => p.actual_margin).length
    : null

  const hasAlerts = overdueInvoices.length > 0 || atRiskProjects.length > 0

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <FirstVisitWizard persona="admin" />
      {/* Greeting */}
      <div>
        <h1 className="font-display text-3xl text-[var(--navy)] leading-tight">
          {user ? greeting(user.full_name) : 'Welcome.'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {todayLabel()} — {activeProjects.length} project{activeProjects.length === 1 ? '' : 's'} active
          {outstandingAR > 0 ? `, $${(outstandingAR / 1000).toFixed(1)}K outstanding` : ''}
        </p>
      </div>

      {/* AI Daily Brief */}
      <Card className="bg-[var(--navy)] border-0" padding="md">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1.5">AI Daily Brief</p>
            {activeProjects.length === 0 && invoices.length === 0 ? (
              <p className="text-white/80 text-sm leading-relaxed">
                No active projects yet. Use the quick actions below to start a site walk, create a proposal, or onboard your first client.
              </p>
            ) : (
              <p className="text-white/80 text-sm leading-relaxed">
                {overdueInvoices.length > 0
                  ? `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} overdue — follow up today. `
                  : ''}
                {atRiskProjects.length > 0
                  ? `${atRiskProjects.map(p => p.title).join(', ')} ${atRiskProjects.length === 1 ? 'is' : 'are'} at risk. `
                  : ''}
                {activeProjects.length > 0 && overdueInvoices.length === 0 && atRiskProjects.length === 0
                  ? `${activeProjects.length} project${activeProjects.length === 1 ? '' : 's'} on track. `
                  : ''}
                {pendingToolCount > 0 ? `${pendingToolCount} tool request${pendingToolCount === 1 ? '' : 's'} from the crew waiting. ` : ''}
                {warrantyCount > 0 ? `${warrantyCount} open warranty claim${warrantyCount === 1 ? '' : 's'} on the books.` : ''}
              </p>
            )}
            <button
              onClick={() => navigate('/admin/ai')}
              className="mt-3 text-white/70 text-xs hover:text-white transition-colors underline underline-offset-2"
            >
              Ask the AI anything →
            </button>
          </div>
        </div>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tooltip content="Total unpaid balance across sent, viewed, and overdue invoices">
          <MetricCard
            label="Outstanding AR"
            value={outstandingAR > 0 ? `$${(outstandingAR / 1000).toFixed(1)}K` : '$0'}
            subtitle={`${invoices.filter(i => ['sent','viewed','partial_paid','overdue'].includes(i.status)).length} invoice${invoices.filter(i => ['sent','viewed','partial_paid','overdue'].includes(i.status)).length === 1 ? '' : 's'}`}
          />
        </Tooltip>
        <Tooltip content="Average actual margin across active projects vs. 38% target">
          <MetricCard
            label="Avg Margin"
            value={avgMargin != null ? `${(avgMargin * 100).toFixed(1)}%` : '--'}
            subtitle="Target: 38%"
          />
        </Tooltip>
        <MetricCard
          label="Active Projects"
          value={activeProjects.length}
          subtitle={activeProjects.length === 0 ? 'None yet' : `${activeProjects.length} in progress`}
        />
        <MetricCard
          label="Total Invoiced"
          value={invoices.length > 0 ? `$${(invoices.reduce((s, i) => s + (i.total ?? 0), 0) / 1000).toFixed(0)}K` : '$0'}
          subtitle="All time"
        />
      </div>

      {/* System Health */}
      <HealthMonitor />

      {/* Alerts */}
      {hasAlerts && (
        <div className="space-y-2">
          {overdueInvoices.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 bg-[var(--danger-bg)] rounded-xl px-4 py-3 border border-red-100">
              <AlertCircle size={16} className="text-[var(--danger)] flex-shrink-0" />
              <p className="text-sm text-[var(--danger)] flex-1 min-w-0">
                <span className="font-semibold">{inv.invoice_number}</span> is overdue — ${(inv.balance_due ?? 0).toLocaleString()} outstanding
              </p>
            </div>
          ))}
          {atRiskProjects.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-[var(--warning-bg)] rounded-xl px-4 py-3 border border-yellow-100">
              <Clock size={16} className="text-[var(--warning)] flex-shrink-0" />
              <p className="text-sm text-[var(--warning)] flex-1 min-w-0">
                <span className="font-semibold">{p.title}</span> is {p.schedule_status === 'behind' ? 'behind schedule' : 'at risk'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Needs Attention */}
      <div>
        <SectionHeader title="Needs Attention" />
        <Card padding="none">
          {pendingTimeCount > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--warning-bg)] flex items-center justify-center flex-shrink-0">
                  <Clock size={14} className="text-[var(--warning)]" />
                </div>
                <p className="text-sm text-[var(--text)]">{pendingTimeCount} manual time {pendingTimeCount === 1 ? 'entry needs' : 'entries need'} review</p>
              </div>
              <button onClick={() => navigate('/admin/time/pending')} className="text-xs font-semibold text-[var(--navy)]">Review →</button>
            </div>
          )}
          {pendingToolCount > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                  <Wrench size={14} className="text-[var(--navy)]" />
                </div>
                <p className="text-sm text-[var(--text)]">{pendingToolCount} tool request{pendingToolCount === 1 ? '' : 's'} from the crew</p>
              </div>
              <button onClick={() => navigate('/admin/settings/tool-requests')} className="text-xs font-semibold text-[var(--navy)]">Review →</button>
            </div>
          )}
          {warrantyCount > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--rust-subtle)] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={14} className="text-[var(--rust)]" />
                </div>
                <p className="text-sm text-[var(--text)]">{warrantyCount} open warranty claim{warrantyCount === 1 ? '' : 's'}</p>
              </div>
              <button onClick={() => navigate('/admin/warranty')} className="text-xs font-semibold text-[var(--navy)]">Review →</button>
            </div>
          )}
          {portfolioCount > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                  <Image size={14} className="text-[var(--navy)]" />
                </div>
                <p className="text-sm text-[var(--text)]">Portfolio — {portfolioCount} curated photo{portfolioCount === 1 ? '' : 's'}</p>
              </div>
              <button onClick={() => navigate('/admin/portfolio')} className="text-xs font-semibold text-[var(--navy)]">Open →</button>
            </div>
          )}
          {pendingTimeCount === 0 && pendingToolCount === 0 && warrantyCount === 0 && portfolioCount === 0 && (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">Nothing needs your attention right now.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-5 gap-2">
          {QUICK_ACTIONS.map(({ label, icon: Icon, color, text, route }) => (
            <button
              key={label}
              onClick={() => navigate(route)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl active:scale-95 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={22} className={text} />
              </div>
              <span className="text-[10px] font-medium text-[var(--text-secondary)] text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Projects */}
      <div>
        <SectionHeader
          title="Active Projects"
          action={
            <button onClick={() => navigate('/admin/projects')} className="text-xs text-[var(--rust)] font-medium hover:opacity-80 transition-opacity">
              See all
            </button>
          }
        />
        <Card padding="none">
          {activeProjects.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-[var(--text-secondary)] mb-3">No active projects yet.</p>
              <button
                onClick={() => navigate('/admin/onboard')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg"
              >
                <Plus size={13} />
                Onboard a client
              </button>
            </div>
          ) : (
            activeProjects.map(project => (
              <div
                key={project.id}
                className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
                onClick={() => navigate(`/admin/projects/${project.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{project.title}</p>
                    <StatusPill status={project.schedule_status} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">{project.current_phase ?? 'No phase set'}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--navy)] rounded-full transition-all"
                        style={{ width: `${project.percent_complete ?? 0}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-mono flex-shrink-0">
                      {project.percent_complete ?? 0}%
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-semibold text-[var(--text)]">
                    ${((project.contract_value ?? 0) / 1000).toFixed(0)}K
                  </p>
                  {project.actual_margin != null && (
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <TrendingUp size={12} className={project.actual_margin >= (project.target_margin ?? 0.38) ? 'text-[var(--success)]' : 'text-[var(--warning)]'} />
                      <span className={`text-[11px] font-mono ${project.actual_margin >= (project.target_margin ?? 0.38) ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                        {(project.actual_margin * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Recent Invoices */}
      <div>
        <SectionHeader
          title="Invoices"
          action={
            <button onClick={() => navigate('/admin/invoices')} className="text-xs text-[var(--rust)] font-medium hover:opacity-80 transition-opacity">
              See all
            </button>
          }
        />
        <Card padding="none">
          {invoices.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-[var(--text-secondary)] mb-3">No invoices yet.</p>
              <button
                onClick={() => navigate('/admin/invoices')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg"
              >
                <Plus size={13} />
                Create invoice
              </button>
            </div>
          ) : (
            invoices.slice(0, 3).map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{inv.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{inv.invoice_number}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusPill status={inv.status} />
                  <span className="font-mono text-sm font-semibold text-[var(--text)]">
                    ${(inv.total ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="h-4" />
    </div>
  )
}
