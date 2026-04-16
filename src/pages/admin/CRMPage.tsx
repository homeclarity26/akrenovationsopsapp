import { useState } from 'react'
import { Plus, Phone, Mail, ArrowLeft, Calendar, MessageSquare, Sparkles, X, Users } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import { SkeletonRow } from '@/components/ui/Skeleton'

// ── Kanban sub-components ─────────────────────────────────────────────────────

function KanbanCard({ lead, onSelect }: { lead: Record<string, unknown>; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id as string,
    data: { lead },
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <button onClick={onSelect} className="w-full text-left touch-none">
        <Card padding="sm" className="cursor-grab active:cursor-grabbing hover:border-[var(--border)]">
          <p className="font-semibold text-xs text-[var(--text)] leading-snug mb-1">{lead.full_name as string}</p>
          <p className="text-[10px] text-[var(--text-secondary)] capitalize mb-2">{lead.project_type as string}</p>
          <p className="font-mono text-sm font-semibold text-[var(--text)]">
            ${((lead.estimated_value as number ?? 0) / 1000).toFixed(0)}K
          </p>
        </Card>
      </button>
    </div>
  )
}

function KanbanColumn({ stageKey, label, leads, onSelect }: {
  stageKey: string
  label: string
  leads: Record<string, unknown>[]
  onSelect: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey })
  return (
    <div className="w-56 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
        <span className="text-xs text-[var(--text-tertiary)] bg-[var(--border-light)] px-1.5 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[60px] rounded-xl p-1 transition-colors ${isOver ? 'bg-[var(--cream-light)]' : ''}`}
      >
        {leads.map(lead => (
          <KanbanCard key={lead.id as string} lead={lead} onSelect={() => onSelect(lead.id as string)} />
        ))}
        {leads.length === 0 && (
          <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">No leads</p>
          </div>
        )}
      </div>
    </div>
  )
}

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

const SOURCES = ['website', 'google_ads', 'referral', 'manual', 'facebook', 'other'] as const
const PROJECT_TYPES = ['kitchen', 'bathroom', 'basement', 'addition', 'first_floor', 'other'] as const

interface AddLeadForm {
  full_name: string
  phone: string
  email: string
  address: string
  project_type: string
  source: string
  estimated_value: string
  notes: string
}

const EMPTY_FORM: AddLeadForm = { full_name: '', phone: '', email: '', address: '', project_type: '', source: 'manual', estimated_value: '', notes: '' }

export function CRMPage() {
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({})
  const [draggingLead, setDraggingLead] = useState<Record<string, unknown> | null>(null)
  const [showAddLead, setShowAddLead] = useState(false)
  const [addForm, setAddForm] = useState<AddLeadForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function handleAddLead() {
    if (!addForm.full_name.trim()) return
    setSaving(true)
    try {
      const { data: lead, error } = await supabase.from('leads').insert({
        full_name: addForm.full_name.trim(),
        phone: addForm.phone.trim() || null,
        email: addForm.email.trim() || null,
        address: addForm.address.trim() || null,
        project_type: addForm.project_type || null,
        source: addForm.source,
        estimated_value: addForm.estimated_value ? parseFloat(addForm.estimated_value) : null,
        notes: addForm.notes.trim() || null,
        stage: 'lead',
        stage_entered_at: new Date().toISOString(),
      }).select().single()
      if (error) throw error
      await supabase.from('lead_activities').insert({
        lead_id: (lead as any).id,
        activity_type: 'note',
        description: 'Lead created',
      })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead added')
      setShowAddLead(false)
      setAddForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingLead(null)
    const { active, over } = event
    if (!over) return
    const leadId = active.id as string
    const newStage = over.id as string
    const currentStage = stageOverrides[leadId] ?? (leads as Record<string, unknown>[]).find((l: any) => l.id === leadId)?.stage
    if (currentStage === newStage) return
    // Optimistic update
    setStageOverrides(prev => ({ ...prev, [leadId]: newStage }))
    // Persist
    const now = new Date().toISOString()
    await supabase.from('leads').update({ stage: newStage, stage_entered_at: now }).eq('id', leadId)
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: 'stage_change',
      description: `Moved to ${STAGES.find(s => s.key === newStage)?.label ?? newStage}`,
    })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  const { data: leads = [], isLoading: leadsLoading, error: leadsError, refetch: leadsRefetch } = useQuery({
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

  if (leadsError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load CRM. Check your connection and try again.</p>
      <button onClick={() => leadsRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="CRM Pipeline"
        subtitle={`${leads.length} active leads`}
        action={<Button size="sm" onClick={() => setShowAddLead(true)}><Plus size={15} />Add Lead</Button>}
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
        <Card padding="none"><SkeletonRow count={4} /></Card>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 px-4">
          <Users size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="font-medium text-sm text-[var(--text)]">No leads yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto">Start tracking prospects and move them through your sales pipeline.</p>
          <button onClick={() => setShowAddLead(true)} className="mt-4 text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-4 py-2 rounded-xl hover:bg-[var(--navy)]/5 transition-colors">
            <Plus size={13} className="inline -mt-0.5 mr-1" />Add Lead
          </button>
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
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => {
            const lead = (leads as Record<string, unknown>[]).find((l: any) => l.id === active.id)
            setDraggingLead(lead ?? null)
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingLead(null)}
        >
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 w-max pb-4">
              {STAGES.map(stage => {
                const stageLeads = (leads as Record<string, unknown>[])
                  .map(l => ({ ...l, stage: stageOverrides[(l as any).id] ?? l.stage }))
                  .filter(l => l.stage === stage.key)
                return (
                  <KanbanColumn
                    key={stage.key}
                    stageKey={stage.key}
                    label={stage.label}
                    leads={stageLeads}
                    onSelect={setSelectedId}
                  />
                )
              })}
            </div>
          </div>
          <DragOverlay>
            {draggingLead ? (
              <div className="w-56 rotate-2 shadow-lg opacity-90">
                <Card padding="sm">
                  <p className="font-semibold text-xs text-[var(--text)] leading-snug mb-1">{draggingLead.full_name as string}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] capitalize mb-2">{draggingLead.project_type as string}</p>
                  <p className="font-mono text-sm font-semibold text-[var(--text)]">
                    ${((draggingLead.estimated_value as number ?? 0) / 1000).toFixed(0)}K
                  </p>
                </Card>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Add Lead Sheet ───────────────────────────────────────────────────── */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowAddLead(false)}>
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl p-5 space-y-4 max-h-[92svh] overflow-y-auto pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-[var(--navy)]">New Lead</h2>
              <button onClick={() => setShowAddLead(false)} className="p-2 rounded-xl text-[var(--text-secondary)]">
                <X size={20} />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Full Name *</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={addForm.full_name}
                onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
              />
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Phone</label>
                <input
                  type="tel"
                  placeholder="(330) 555-0100"
                  value={addForm.phone}
                  onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Email</label>
                <input
                  type="email"
                  placeholder="jane@email.com"
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Address</label>
              <input
                type="text"
                placeholder="123 Main St, Akron, OH"
                value={addForm.address}
                onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
              />
            </div>

            {/* Project type + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Project Type</label>
                <select
                  value={addForm.project_type}
                  onChange={e => setAddForm(f => ({ ...f, project_type: e.target.value }))}
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
                >
                  <option value="">Select...</option>
                  {PROJECT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Source</label>
                <select
                  value={addForm.source}
                  onChange={e => setAddForm(f => ({ ...f, source: e.target.value }))}
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] min-h-[44px]"
                >
                  {SOURCES.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>

            {/* Estimated value */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Estimated Value</label>
              <input
                type="number"
                placeholder="e.g. 45000"
                value={addForm.estimated_value}
                onChange={e => setAddForm(f => ({ ...f, estimated_value: e.target.value }))}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] font-mono min-h-[44px]"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">Notes</label>
              <textarea
                placeholder="Interested in full kitchen remodel, has budget..."
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg)] resize-none"
              />
            </div>

            <button
              onClick={handleAddLead}
              disabled={saving || !addForm.full_name.trim()}
              className="w-full py-3.5 rounded-xl bg-[var(--navy)] text-white font-semibold text-sm min-h-[48px] disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
