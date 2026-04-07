import { useState } from 'react'
import { Plus, Phone, Mail, ArrowLeft, Calendar, MessageSquare, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MOCK_LEADS } from '@/data/mock'

const STAGES = [
  { key: 'lead',            label: 'Lead' },
  { key: 'consultation',    label: 'Consultation' },
  { key: 'proposal_sent',   label: 'Proposal Sent' },
  { key: 'contract_signed', label: 'Contract Signed' },
  { key: 'active_project',  label: 'Active' },
  { key: 'complete',        label: 'Complete' },
]

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: MessageSquare,
}

export function CRMPage() {
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedLead = MOCK_LEADS.find(l => l.id === selectedId)

  if (selectedLead) {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={15} />
          CRM Pipeline
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-[var(--navy)]">{selectedLead.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill status={selectedLead.stage} />
              <span className="text-xs text-[var(--text-tertiary)] capitalize">{selectedLead.project_type} · {selectedLead.days_in_stage}d in stage</span>
            </div>
          </div>
          <p className="font-mono text-lg font-bold text-[var(--text)]">${(selectedLead.estimated_value/1000).toFixed(0)}K</p>
        </div>

        {/* Contact */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Contact</p>
          <div className="space-y-2">
            <a href={`tel:${selectedLead.phone.replace(/\D/g,'')}`} className="flex items-center gap-2 text-sm text-[var(--navy)]">
              <Phone size={14} />
              {selectedLead.phone}
            </a>
            <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-2 text-sm text-[var(--navy)]">
              <Mail size={14} />
              {selectedLead.email}
            </a>
            <p className="text-sm text-[var(--text-secondary)]">{selectedLead.address}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <a
              href={`tel:${selectedLead.phone.replace(/\D/g,'')}`}
              className="py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
            >
              <Phone size={14} />
              Call
            </a>
            <a
              href={`mailto:${selectedLead.email}`}
              className="py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] flex items-center justify-center gap-1.5"
            >
              <Mail size={14} />
              Email
            </a>
          </div>
        </Card>

        {/* Next action */}
        {selectedLead.next_action && (
          <div className="flex items-start gap-3 p-4 bg-[var(--warning-bg)] rounded-2xl border border-yellow-100">
            <Calendar size={16} className="text-[var(--warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--warning)]">Next Action</p>
              <p className="text-sm text-[var(--warning)] mt-0.5">{selectedLead.next_action} — {selectedLead.next_action_date}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {selectedLead.notes && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Notes</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{selectedLead.notes}</p>
          </Card>
        )}

        {/* AI Follow-up draft */}
        <Card className="bg-[var(--navy)] border-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-white" />
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">AI Follow-Up Draft</p>
          </div>
          <p className="text-white text-sm leading-relaxed">
            Hi {selectedLead.full_name.split(' ')[0]} — I wanted to follow up and see if you had any questions about{' '}
            {selectedLead.stage === 'proposal_sent' ? 'the proposal we sent over' : 'next steps for your project'}.
            We'd love to get started and can typically accommodate within 4–6 weeks. Let me know if you'd like to chat!
          </p>
          <button className="mt-3 text-white/70 text-xs underline underline-offset-2 hover:text-white transition-colors">
            Send this follow-up →
          </button>
        </Card>

        {/* Activity timeline */}
        <div>
          <SectionHeader title="Activity Timeline" />
          <div className="space-y-2">
            {selectedLead.activities.map((act, i) => {
              const ActivityIcon = ACTIVITY_ICONS[act.type] ?? MessageSquare
              return (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ActivityIcon size={14} className="text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex-1 bg-[var(--white)] border border-[var(--border-light)] rounded-xl p-3">
                    <p className="text-sm text-[var(--text)]">{act.desc}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{act.date} · {act.by}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="CRM Pipeline"
        subtitle={`${MOCK_LEADS.length} active leads`}
        action={<Button size="sm"><Plus size={15} />Add Lead</Button>}
      />

      {/* View toggle */}
      <div className="flex gap-1 bg-[var(--border-light)] rounded-lg p-1 w-fit">
        {(['list', 'kanban'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              view === v ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <Card padding="none">
          {MOCK_LEADS.map(lead => (
            <div
              key={lead.id}
              onClick={() => setSelectedId(lead.id)}
              className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{lead.full_name}</p>
                  {lead.source === 'referral' && (
                    <span className="text-[9px] font-semibold uppercase bg-[var(--rust-subtle)] text-[var(--rust)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Referral
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={lead.stage} />
                  <span className="text-[11px] text-[var(--text-tertiary)] capitalize">{lead.project_type} · {lead.days_in_stage}d</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate">{lead.next_action}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="font-mono text-sm font-semibold text-[var(--text)]">
                  ${(lead.estimated_value / 1000).toFixed(0)}K
                </p>
                <div className="flex gap-1">
                  <button className="p-2 rounded-lg bg-[var(--border-light)] text-[var(--text-secondary)] hover:bg-gray-100 transition-colors">
                    <Phone size={13} />
                  </button>
                  <button className="p-2 rounded-lg bg-[var(--border-light)] text-[var(--text-secondary)] hover:bg-gray-100 transition-colors">
                    <Mail size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-3 w-max pb-4">
            {STAGES.map(stage => {
              const leads = MOCK_LEADS.filter(l => l.stage === stage.key)
              return (
                <div key={stage.key} className="w-56 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">{stage.label}</p>
                    <span className="text-xs text-[var(--text-tertiary)] bg-[var(--border-light)] px-1.5 py-0.5 rounded-full">
                      {leads.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {leads.map(lead => (
                      <button key={lead.id} onClick={() => setSelectedId(lead.id)} className="w-full text-left">
                        <Card padding="sm" className="cursor-pointer hover:border-[var(--border)]">
                          <p className="font-semibold text-xs text-[var(--text)] leading-snug mb-1">{lead.full_name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] capitalize mb-2">{lead.project_type}</p>
                          <p className="font-mono text-sm font-semibold text-[var(--text)]">
                            ${(lead.estimated_value / 1000).toFixed(0)}K
                          </p>
                        </Card>
                      </button>
                    ))}
                    {leads.length === 0 && (
                      <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center">
                        <p className="text-xs text-[var(--text-tertiary)]">No leads</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
