import { useNavigate } from 'react-router-dom'
import { ScanLine, FileText, Send, Sparkles, TrendingUp, AlertCircle, Clock, Image, ShieldCheck, Wrench } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useAuth } from '@/context/AuthContext'
import {
  MOCK_PROJECTS, MOCK_FINANCIALS, MOCK_INVOICES,
  MOCK_TOOL_REQUESTS, MOCK_WARRANTY_CLAIMS_FULL, MOCK_PORTFOLIO_PHOTOS,
} from '@/data/mock'
import { ComplianceStatusMini } from './CompliancePage'

function greeting(name: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name.split(' ')[0]}.`
}

const QUICK_ACTIONS = [
  { label: 'Site Walk', icon: ScanLine, color: 'bg-[var(--cream-light)]', text: 'text-[var(--navy)]', route: '/admin/walkthrough' },
  { label: 'Proposals', icon: FileText, color: 'bg-[var(--rust-subtle)]', text: 'text-[var(--rust)]', route: '/admin/proposals' },
  { label: 'Invoices', icon: Send, color: 'bg-[var(--success-bg)]', text: 'text-[var(--success)]', route: '/admin/invoices' },
  { label: 'Time', icon: Clock, color: 'bg-[var(--warning-bg)]', text: 'text-[var(--warning)]', route: '/employee/time' },
  { label: 'AI Command', icon: Sparkles, color: 'bg-[var(--navy)]', text: 'text-white', route: '/admin/ai' },
]

export function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const overdue = MOCK_INVOICES.filter(i => i.status === 'overdue')
  const atRisk = MOCK_PROJECTS.filter(p => p.schedule_status === 'at_risk')
  const pendingToolRequests = MOCK_TOOL_REQUESTS.filter(r => r.status === 'pending')
  const openWarrantyClaims = MOCK_WARRANTY_CLAIMS_FULL.filter(c => c.status !== 'resolved' && c.status !== 'denied')

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-3xl text-[var(--navy)] leading-tight">
          {user ? greeting(user.full_name) : 'Welcome.'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Monday, April 6, 2026 — 2 projects active, $47.2K outstanding
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
            <p className="text-white text-sm leading-relaxed">
              Thompson milestone invoice is 5 days overdue — follow up today. Johnson tile work is on track for
              Thursday completion. You have 2 leads awaiting response and one proposal pending signature from the Fosters.
              {pendingToolRequests.length > 0 && ` ${pendingToolRequests.length} tool request${pendingToolRequests.length === 1 ? '' : 's'} from the crew waiting on you.`}
              {openWarrantyClaims.length > 0 && ` ${openWarrantyClaims.length} open warranty claim${openWarrantyClaims.length === 1 ? '' : 's'} on the books.`}
            </p>
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
        <MetricCard
          label="Revenue YTD"
          value={`$${(MOCK_FINANCIALS.revenue_ytd / 1000).toFixed(0)}K`}
          subtitle="+18% vs last year"
        />
        <MetricCard
          label="Avg Margin"
          value={`${(MOCK_FINANCIALS.avg_margin * 100).toFixed(1)}%`}
          subtitle="Target: 38%"
        />
        <MetricCard
          label="Outstanding AR"
          value={`$${(MOCK_FINANCIALS.outstanding_ar / 1000).toFixed(1)}K`}
          subtitle="2 invoices"
        />
        <MetricCard
          label="Active Projects"
          value={MOCK_FINANCIALS.active_projects}
          subtitle="2 employees on site"
        />
      </div>

      {/* Alerts */}
      {(overdue.length > 0 || atRisk.length > 0) && (
        <div className="space-y-2">
          {overdue.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 bg-[var(--danger-bg)] rounded-xl px-4 py-3 border border-red-100">
              <AlertCircle size={16} className="text-[var(--danger)] flex-shrink-0" />
              <p className="text-sm text-[var(--danger)] flex-1 min-w-0">
                <span className="font-semibold">{inv.invoice_number}</span> is overdue — ${inv.balance_due.toLocaleString()} owed by {inv.client_name}
              </p>
            </div>
          ))}
          {atRisk.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-[var(--warning-bg)] rounded-xl px-4 py-3 border border-yellow-100">
              <Clock size={16} className="text-[var(--warning)] flex-shrink-0" />
              <p className="text-sm text-[var(--warning)] flex-1 min-w-0">
                <span className="font-semibold">{p.title}</span> is at risk — framing behind pace
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Compliance Status */}
      <div onClick={() => navigate('/admin/compliance')} className="cursor-pointer">
        <ComplianceStatusMini />
      </div>

      {/* Needs Attention */}
      <div>
        <SectionHeader title="Needs Attention" />
        <Card padding="none">
          <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--warning-bg)] flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-[var(--warning)]" />
              </div>
              <p className="text-sm text-[var(--text)]">1 manual time entry needs review</p>
            </div>
            <button onClick={() => navigate('/admin/time/pending')} className="text-xs font-semibold text-[var(--navy)]">
              Review →
            </button>
          </div>
          {pendingToolRequests.length > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                  <Wrench size={14} className="text-[var(--navy)]" />
                </div>
                <p className="text-sm text-[var(--text)]">
                  {pendingToolRequests.length} tool request{pendingToolRequests.length === 1 ? '' : 's'} from the crew
                </p>
              </div>
              <button onClick={() => navigate('/admin/settings/tool-requests')} className="text-xs font-semibold text-[var(--navy)]">
                Review →
              </button>
            </div>
          )}
          {openWarrantyClaims.length > 0 && (
            <div className="flex items-center justify-between py-3 px-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--rust-subtle)] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={14} className="text-[var(--rust)]" />
                </div>
                <p className="text-sm text-[var(--text)]">
                  {openWarrantyClaims.length} open warranty claim{openWarrantyClaims.length === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => navigate('/admin/warranty')} className="text-xs font-semibold text-[var(--navy)]">
                Review →
              </button>
            </div>
          )}
          <div className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                <Image size={14} className="text-[var(--navy)]" />
              </div>
              <p className="text-sm text-[var(--text)]">
                Portfolio · {MOCK_PORTFOLIO_PHOTOS.length} curated photos
              </p>
            </div>
            <button onClick={() => navigate('/admin/portfolio')} className="text-xs font-semibold text-[var(--navy)]">
              Open →
            </button>
          </div>
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
            <button
              onClick={() => navigate('/admin/projects')}
              className="text-xs text-[var(--rust)] font-medium hover:opacity-80 transition-opacity"
            >
              See all
            </button>
          }
        />
        <Card padding="none">
          {MOCK_PROJECTS.filter(p => p.status === 'active').map(project => (
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
                <p className="text-xs text-[var(--text-secondary)] mb-2">{project.current_phase}</p>
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--navy)] rounded-full transition-all"
                      style={{ width: `${project.percent_complete}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono flex-shrink-0">
                    {project.percent_complete}%
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-sm font-semibold text-[var(--text)]">
                  ${(project.contract_value / 1000).toFixed(0)}K
                </p>
                {project.actual_margin && (
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <TrendingUp size={12} className={project.actual_margin >= project.target_margin ? 'text-[var(--success)]' : 'text-[var(--warning)]'} />
                    <span className={`text-[11px] font-mono ${project.actual_margin >= project.target_margin ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                      {(project.actual_margin * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Recent Invoices */}
      <div>
        <SectionHeader
          title="Invoices"
          action={
            <button
              onClick={() => navigate('/admin/invoices')}
              className="text-xs text-[var(--rust)] font-medium hover:opacity-80 transition-opacity"
            >
              See all
            </button>
          }
        />
        <Card padding="none">
          {MOCK_INVOICES.slice(0, 3).map(inv => (
            <div
              key={inv.id}
              className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--text)] truncate">{inv.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">{inv.invoice_number} · {inv.client_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusPill status={inv.status} />
                <span className="font-mono text-sm font-semibold text-[var(--text)]">
                  ${inv.total.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="h-4" />
    </div>
  )
}
