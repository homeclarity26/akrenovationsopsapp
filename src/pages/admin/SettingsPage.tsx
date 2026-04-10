import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, User, Brain, Zap, AlertTriangle, Layers, Wrench, BookOpen, UserPlus, LayoutTemplate } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'

const INTEGRATIONS = [
  { name: 'QuickBooks Online',  desc: 'Sync invoices, expenses, payments', connected: false, icon: '📊' },
  { name: 'Google Calendar',    desc: 'Two-way schedule sync',              connected: true,  icon: '📅' },
  { name: 'Twilio SMS',         desc: 'Business phone for client SMS',       connected: false, icon: '📱' },
  { name: 'Stripe Payments',    desc: 'Online invoice payments',             connected: false, icon: '💳' },
]

const EMPLOYEES = [
  { name: 'Jeff Miller',   role: 'Field',  active: true  },
  { name: 'Steven Clark',  role: 'Field',  active: true  },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { data: company } = useCompanyProfile()
  const [notifications, setNotifications] = useState({
    new_lead: true,
    invoice_paid: true,
    message: true,
    ai_action: false,
  })

  const toggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Settings" subtitle="Company & account preferences" />

      {/* AI Memory */}
      <div>
        <SectionHeader title="AI" />
        <Card padding="none">
          <button
            onClick={() => navigate('/admin/settings/context')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors rounded-2xl min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
              <BookOpen size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">Business Context</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Edit what the AI knows about your business</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/admin/settings/memory')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
              <Brain size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">Memory Inspector</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">View and edit what the AI knows about your business</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/admin/settings/agents')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
              <Zap size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">AI Agents</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Manage all 27 autonomous agents</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/admin/settings/materials')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
              <Layers size={17} className="text-[var(--navy)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">Material Specs</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Preferred products surfaced by AI walkthroughs</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/admin/settings/tool-requests')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
              <Wrench size={17} className="text-[var(--navy)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">Tool Requests</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Approve crew tool purchases</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/admin/settings/approvals')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--rust)] flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">Pending Approvals</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Review AI actions before they execute</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
          <button
            onClick={() => navigate('/admin/settings/templates')}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-[var(--bg)] transition-colors border-t border-[var(--border-light)] min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
              <LayoutTemplate size={17} className="text-[var(--navy)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">Templates</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Manage scope, proposal, checklist, and punch list templates</p>
            </div>
            <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
          </button>
        </Card>
      </div>

      {/* Profile */}
      <div>
        <SectionHeader title="Profile" />
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
              <User size={24} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">Adam Kilgore</p>
              <p className="text-xs text-[var(--text-secondary)]">adam@akrenovations.com</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Admin · Owner</p>
            </div>
          </div>
          <button className="w-full py-2.5 border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] font-medium">
            Edit Profile
          </button>
        </Card>
      </div>

      {/* Company */}
      <div>
        <SectionHeader title="Company" />
        <Card>
          <div className="flex items-center gap-3 mb-4">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[var(--rust)] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{company?.name?.[0] ?? 'C'}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-[var(--text)]">{company?.name ?? 'Your Company'}</p>
              <p className="text-xs text-[var(--text-secondary)]">{[company?.city, company?.state].filter(Boolean).join(', ') || '—'}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <p className="text-[var(--text-secondary)]">License</p>
              <p className="text-[var(--text)]">OH-RC-2019-4847</p>
            </div>
            <div className="flex justify-between">
              <p className="text-[var(--text-secondary)]">Business phone</p>
              <p className="text-[var(--text)]">(330) 555-0100</p>
            </div>
            <div className="flex justify-between">
              <p className="text-[var(--text-secondary)]">Target margin</p>
              <p className="text-[var(--text)]">38%</p>
            </div>
          </div>
          <button className="w-full py-2.5 border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] font-medium mt-4">
            Edit Company Info
          </button>
        </Card>
      </div>

      {/* Integrations */}
      <div>
        <SectionHeader title="Integrations" />
        <Card padding="none">
          {INTEGRATIONS.map(int => (
            <div key={int.name} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
              <span className="text-2xl flex-shrink-0">{int.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--text)]">{int.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{int.desc}</p>
              </div>
              {int.connected ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                  <span className="text-xs text-[var(--success)] font-medium">Connected</span>
                </div>
              ) : (
                <button className="flex-shrink-0 text-xs text-[var(--navy)] font-semibold border border-[var(--navy)] px-3 py-1.5 rounded-lg">
                  Connect
                </button>
              )}
            </div>
          ))}
        </Card>
      </div>

      {/* Notifications */}
      <div>
        <SectionHeader title="Notifications" />
        <Card padding="none">
          {[
            { key: 'new_lead' as const, label: 'New lead received', desc: 'Website form or referral' },
            { key: 'invoice_paid' as const, label: 'Invoice paid', desc: 'Client pays an invoice' },
            { key: 'message' as const, label: 'New message', desc: 'Client or employee messages' },
            { key: 'ai_action' as const, label: 'AI action required', desc: 'High-risk actions needing approval' },
          ].map(n => (
            <div key={n.key} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
              <div className="flex-1">
                <p className="font-medium text-sm text-[var(--text)]">{n.label}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{n.desc}</p>
              </div>
              <button
                onClick={() => toggle(n.key)}
                className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${notifications[n.key] ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${notifications[n.key] ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </Card>
      </div>

      {/* Employees */}
      <div>
        <SectionHeader title="Employees" />
        <Card padding="none">
          {EMPLOYEES.map(emp => (
            <div key={emp.name} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
              <div className="w-9 h-9 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-[var(--text-secondary)]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-[var(--text)]">{emp.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{emp.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                <ChevronRight size={15} className="text-[var(--text-tertiary)]" />
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/admin/onboard')}
            className="flex items-center gap-2 p-4 w-full text-left text-[var(--navy)] text-sm font-medium border-t border-[var(--border-light)]"
          >
            <UserPlus size={16} />
            Onboard New Person
          </button>
        </Card>
      </div>

      {/* Bonus plan */}
      <div>
        <SectionHeader title="Bonus Plan" />
        <Card>
          <div className="space-y-2">
            {[
              { label: 'Bathroom / Small Kitchen', amount: '$900' },
              { label: 'Full Kitchen / Basement',  amount: '$600' },
              { label: 'Addition / Large Project', amount: '$350' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-1">
                <p className="text-sm text-[var(--text-secondary)]">{row.label}</p>
                <p className="font-mono text-sm font-bold text-[var(--navy)]">{row.amount}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
            <p className="text-xs text-[var(--text-tertiary)]">
              Both schedule and margin targets must be met. Margin target: 38%.
            </p>
          </div>
        </Card>
      </div>

      <div className="h-4" />
    </div>
  )
}
