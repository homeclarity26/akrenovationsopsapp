import { useState } from 'react'
import { Plus, Phone, Mail, ArrowLeft, Calendar, MessageSquare, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'

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

function computeDaysInStage(lead: Record<string, unknown>): number {
  const ref = (lead.stage_entered_at ?? lead.created_at) as string | null
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000)
}

export function CRMPage() {
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: selectedLead } = useQuery({
    queryKey: ['lead', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('id', selectedId!)
        .single()
      return data ?? null
    },
  })

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['lead_activities', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', selectedId!)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  if (selectedId) {
    if (!selectedLead) {
      return (
        <div className="p-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft size={15} />
            CRM Pipeline
          </button>
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
          </div>
        </div>
      )
    }

    const lead = selectedLead as Record<string, unknown>
    const daysInStage = computeDaysInStage(lead)
    const leadFullName = String(lead.full_name ?? '')
    const leadPhone = lead.phone ? String(lead.phone) : ''
    const leadEmail = lead.email ? String(lead.email) : ''
    const leadAddress = lead.address ? String(lead.address) : ''
    const leadProjectType = String(lead.project_type ?? '')
    const leadStage = String(lead.stage ?? '')
    const leadEstimatedValue = Number(lead.estimated_value ?? 0)
    const leadNextAction = lead.next_action ? String(lead.next_action) : ''
    const leadNextActionDate = lead.next_action_date ? String(lead.next_action_date) : ''
    const leadNotes = lead.notes ? String(lead.notes) : ''

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
            <h1 className="font-display text-2xl text-[var(--navy)]">{leadFullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill status={leadStage} />
              <span className="text-xs text-[var(--text-tertiary)] capitalize">{leadProjectType} · {daysInStage}d in stage</span>
            </div>
          </div>
          <p className="font-mono text-lg font-bold text-[var(--text)]">${(leadEstimatedValue / 1000).toFixed(0)}K</p>
        </div>

        {/* Contact */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Contact</p>
          <div className="space-y-2">
            {leadPhone && (
              <a href={`tel:${leadPhone.replace(/\D/g,'')}`} className="flex items-center gap-2 text-sm text-[var(--navy)]">
                <Phone size={14} />
                {leadPhone}
              </a>
            )}
            {leadEmail && (
              <a href={`mailto:${leadEmail}`} className="flex items-center gap-2 text-sm text-[var(--navy)]">
                <Mail size={14} />
                {leadEmail}
              </a>
            )}
            {leadAddress && (
              <p className="text-sm text-[var(--text-secondary)]">{leadAddress}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {leadPhone && (
              <a
                href={`tel:${leadPhone.replace(/\D/g,'')}`}
                className="py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Phone size={14} />
                Call
              </a>
            )}
            {leadEmail && (
              <a
                href={`mailto:${leadEmail}`}
                className="py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] flex items-center justify-center gap-1.5"
              >
                <Mail size={14} />
                Email
              </a>
            )}
          </div>
        </Card>

        {/* Next action */}
        {leadNextAction && (
          <div className="flex items-start gap-3 p-4 bg-[var(--warning-bg)] rounded-2xl border border-yellow-100">
            <Calendar size={16} className="text-[var(--warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--warning)]">Next Action</p>
              <p className="text-sm text-[var(--warning)] mt-0.5">{leadNextAction}{leadNextActionDate ? ` — ${leadNextActionDate}` : ''}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {leadNotes && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Notes</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{leadNotes}</p>
          </Card>
        )}

        {/* AI Follow-up draft */}
        <Card className="bg-[var(--navy)] border-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-white" />
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">AI Follow-Up Draft</p>
          </div>
          <p className="text-white text-sm leading-relaxed">
            Hi {leadFullName.split(' ')[0]} — I wanted to follow up and see if you had any questions about{' '}
            {leadStage === 'proposal_sent' ? 'the proposal we sent over' : 'next steps for your project'}.
            We'd love to get started and can typically accommodate within 4–6 weeks. Let me know if you'd like to chat!
          </p>
          <button className="mt-3 text-white/70 text-xs underline underline-offset-2 hover:text-white transition-colors">
            Send this follow-up →
          </button>
        </Card>

        {/* Activity timeline */}
        <div>
          <SectionHeader title="Activity Timeline" />
          {activitiesLoading ? (
            <div className="py-4 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="font-medium text-sm text-[var(--text)]">No activity yet</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Log a call, email, or note to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(activities as Record<string, unknown>[]).map((act) => {
                const ActivityIcon = ACTIVITY_ICONS[act.activity_type as string] ?? MessageSquare
                return (
                  <div key={act.id as string} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ActivityIcon size={14} className="text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 bg-[var(--white)] border border-[var(--border-light)] rounded-xl p-3">
                      <p className="text-sm text-[var(--text)]">{act.description as string}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        {new Date(act.created_at as string).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="CRM Pipeline"
        subtitle={`${leads.length} active leads`}
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

      {leadsLoading ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="font-medium text-sm text-[var(--text)]">No leads yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Add your first lead to get started.</p>
        </div>
      ) : view === 'list' ? (
        <Card padding="none">
          {(leads as Record<string, unknown>[]).map(lead => (
            <div
              key={lead.id as string}
              onClick={() => setSelectedId(lead.id as string)}
              className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-light)] last:border-0 cursor-pointer active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{lead.full_name as string}</p>
                  {lead.source === 'referral' && (
                    <span className="text-[9px] font-semibold uppercase bg-[var(--rust-subtle)] text-[var(--rust)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Referral
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={lead.stage as string} />
                  <span className="text-[11px] text-[var(--text-tertiary)] capitalize">
                    {lead.project_type as string} · {computeDaysInStage(lead)}d
                  </span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate">{lead.next_action as string}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="font-mono text-sm font-semibold text-[var(--text)]">
                  ${((lead.estimated_value as number) / 1000).toFixed(0)}K
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
              const stageLeads = (leads as Record<string, unknown>[]).filter(l => l.stage === stage.key)
              return (
                <div key={stage.key} className="w-56 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">{stage.label}</p>
                    <span className="text-xs text-[var(--text-tertiary)] bg-[var(--border-light)] px-1.5 py-0.5 rounded-full">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map(lead => (
                      <button key={lead.id as string} onClick={() => setSelectedId(lead.id as string)} className="w-full text-left">
                        <Card padding="sm" className="cursor-pointer hover:border-[var(--border)]">
                          <p className="font-semibold text-xs text-[var(--text)] leading-snug mb-1">{lead.full_name as string}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] capitalize mb-2">{lead.project_type as string}</p>
                          <p className="font-mono text-sm font-semibold text-[var(--text)]">
                            ${((lead.estimated_value as number) / 1000).toFixed(0)}K
                          </p>
                        </Card>
                      </button>
                    ))}
                    {stageLeads.length === 0 && (
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
