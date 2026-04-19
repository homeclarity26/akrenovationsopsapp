import { useState, useEffect } from 'react'
import { Plus, Eye, Send, ChevronRight, Image as ImageIcon, X, Sparkles, Loader2, FileText } from 'lucide-react'
import { ShareMenu } from '@/components/ui/ShareMenu'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EditableDeliverable } from '@/components/ui/EditableDeliverable'
import type { EditableItem } from '@/components/ui/EditableDeliverable'
import { supabase } from '@/lib/supabase'
import { buildProposalDocxBlob, SCOPE_FRAMEWORKS, defaultProposalData } from '@/lib/proposalGenerator'
import type { ProposalData, ScopeSection } from '@/lib/proposalGenerator'

type ProposalRecord = Record<string, unknown>

const PROJECT_TYPES = ['Bathroom Remodel', 'Kitchen Remodel', 'Basement Finish', 'Porch / Deck', 'Flooring', 'Addition', 'Whole-Home Renovation', 'Exterior', 'Other']

const PROJECT_TYPE_TO_FRAMEWORK: Record<string, string> = {
  'Bathroom Remodel': 'bathroom',
  'Kitchen Remodel': 'kitchen',
  'Basement Finish': 'basement',
  'Porch / Deck': 'porch',
  'Flooring': 'flooring',
}

function buildProposalData(proposal: ProposalRecord): ProposalData {
  const clientName = String(proposal.client_name ?? '')
  const nameParts = clientName.split(' ')
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : clientName
  const address = String(proposal.client_address ?? '')
  const addressParts = address.split(',').map(s => s.trim())

  const projectType = String(proposal.project_type ?? '')
  const frameworkKey = PROJECT_TYPE_TO_FRAMEWORK[projectType]
  const framework = frameworkKey ? SCOPE_FRAMEWORKS[frameworkKey] : undefined

  const dbSections = (proposal.sections as { title: string; bullets: string[] }[]) ?? []
  const sections: ScopeSection[] = dbSections.length > 0
    ? dbSections.map((s, i) => ({
        number: `Section ${String(i + 1).padStart(2, '0')}`,
        title: s.title,
        bullets: (s.bullets ?? []).map(b => {
          const parts = b.split(':')
          return parts.length > 1
            ? { label: parts[0].trim(), desc: parts.slice(1).join(':').trim() }
            : { label: b, desc: null }
        }),
      }))
    : (framework ?? []).map(s => ({ ...s, bullets: [] }))

  const totalPrice = Number(proposal.total_price) || 0
  const sectionCount = sections.length

  return {
    ...defaultProposalData,
    clientLastName: lastName,
    clientFullNames: clientName,
    address1: addressParts[0] || '',
    address2: addressParts.slice(1).join(', ') || '',
    projectType: projectType.toUpperCase() + ' PROPOSAL',
    duration: String(proposal.duration ?? '8–12 weeks'),
    overviewTitle: String(proposal.overview_title ?? `Your ${projectType}`),
    overviewBody: String(proposal.overview_body ?? ''),
    totalPrice: `$${totalPrice.toLocaleString()}`,
    sectionRange: sectionCount > 0 ? `SECTIONS 01–${String(sectionCount).padStart(2, '0')}` : '',
    hasAddOn: false,
    addOnName: '',
    addOnDetail: '',
    addOnPrice: '',
    estimatedDuration: String(proposal.duration ?? '8–12 weeks'),
    sections,
    selections: [],
  }
}

export function ProposalsPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [localProposals, setLocalProposals] = useState<ProposalRecord[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  const { data: fetchedProposals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as ProposalRecord[]
    },
  })

  useEffect(() => {
    if (fetchedProposals.length > 0 && localProposals.length === 0) {
      setLocalProposals(fetchedProposals)
    }
  }, [fetchedProposals, localProposals.length])

  const proposals = localProposals.length > 0 ? localProposals : fetchedProposals
  const viewing = proposals.find(p => p.id === selected) ?? null

  const handleAiGenerate = async (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId)
    if (!proposal) return

    setAiGenerating(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)

      const res = await fetch(`${supabaseUrl}/functions/v1/agent-proposal-writer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposal_id: proposalId,
          client_name: proposal.client_name,
          client_address: proposal.client_address,
          project_type: proposal.project_type,
          total_price: proposal.total_price,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const result = await res.json()

      if (result.sections || result.overview_body) {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (result.sections) updates.sections = result.sections
        if (result.overview_body) updates.overview_body = result.overview_body
        if (result.overview_title) updates.overview_title = result.overview_title
        if (result.duration) updates.duration = result.duration

        await supabase.from('proposals').update(updates).eq('id', proposalId)

        setLocalProposals(prev =>
          prev.map(p => p.id === proposalId ? { ...p, ...updates } : p)
        )
      }

      await refetch()
    } catch (err) {
      alert('AI generation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setAiGenerating(false)
    }
  }

  if (viewing) {
    const viewingSections = (viewing.sections as { title: string; bullets: string[] }[]) ?? []
    const paymentSchedule = (viewing as ProposalRecord & { payment_schedule?: { label?: string; name?: string; percent?: number }[] }).payment_schedule

    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          ← Back to Proposals
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-[var(--navy)] leading-tight">{String(viewing.title ?? '')}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{String(viewing.client_name ?? '')}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl font-bold text-[var(--text)]">${((viewing.total_price as number) / 1000).toFixed(0)}K</p>
            <StatusPill status={viewing.status as string} />
          </div>
        </div>

        {/* AI Generate + Download actions */}
        <div className="flex gap-2">
          <Button
            variant="ai"
            size="sm"
            onClick={() => handleAiGenerate(viewing.id as string)}
            disabled={aiGenerating}
          >
            {aiGenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {aiGenerating ? 'Generating...' : 'Generate with AI'}
          </Button>
          <ShareMenu
            kind="proposal"
            documentId={String(viewing.id)}
            documentTitle={String(viewing.title ?? 'Proposal')}
            defaultEmail={String((viewing as Record<string, unknown>).client_email ?? '')}
            defaultPhone={String((viewing as Record<string, unknown>).client_phone ?? '')}
            buildDocx={() => buildProposalDocxBlob(buildProposalData(viewing))}
          />
        </div>

        {/* Overview */}
        {!!viewing.overview_body && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Project Overview</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{String(viewing.overview_body)}</p>
          </Card>
        )}

        {/* Scope sections */}
        {viewingSections.map((section, i) => (
          <Card key={i}>
            <p className="font-semibold text-sm text-[var(--text)] mb-2">{section.title}</p>
            <EditableDeliverable
              deliverableType="proposal"
              instanceId={viewing.id as string}
              instanceTable="proposals"
              items={section.bullets.map((b: string, j: number): EditableItem => ({ id: String(j), title: b }))}
              onSave={async (editedItems) => {
                const updatedSections = (viewing.sections as { title: string; bullets: string[] }[]).map((s, si) =>
                  si === i ? { ...s, bullets: editedItems.map((ei) => ei.title) } : s,
                )
                setLocalProposals((prev) =>
                  prev.map((p) =>
                    p.id === viewing.id ? { ...p, sections: updatedSections } : p,
                  ),
                )
                await supabase
                  .from('proposals')
                  .update({ sections: updatedSections, updated_at: new Date().toISOString() })
                  .eq('id', viewing.id as string)
              }}
              isEditable={true}
              showPromoteOption={true}
            />
          </Card>
        ))}

        {/* Payment Schedule */}
        {(() => {
          if (paymentSchedule && paymentSchedule.length > 0) {
            const milestoneItems: EditableItem[] = paymentSchedule.map((m, idx) => ({
              id: String(idx),
              title: m.label ?? m.name ?? 'Milestone',
              description: m.percent != null ? `${m.percent}%` : undefined,
            }))
            return (
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Payment Schedule</p>
                <EditableDeliverable
                  deliverableType="payment_schedule"
                  instanceId={viewing.id as string}
                  instanceTable="proposals"
                  items={milestoneItems}
                  onSave={async (editedItems) => {
                    const updatedSchedule = editedItems.map((ei) => ({ label: ei.title, percent: ei.description ? Number(ei.description) : undefined }))
                    setLocalProposals((prev) =>
                      prev.map((p) =>
                        p.id === viewing.id ? { ...p, payment_schedule: updatedSchedule } : p
                      )
                    )
                    await supabase
                      .from('proposals')
                      .update({ payment_schedule: updatedSchedule, updated_at: new Date().toISOString() })
                      .eq('id', viewing.id as string)
                  }}
                  isEditable={true}
                  showPromoteOption={true}
                />
              </Card>
            )
          }
          return (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Payment Schedule</p>
              <p className="text-sm text-[var(--text-tertiary)] mb-3">No payment schedule — add milestones</p>
              <EditableDeliverable
                deliverableType="payment_schedule"
                instanceId={viewing.id as string}
                instanceTable="proposals"
                items={[]}
                onSave={async (editedItems) => {
                  const updatedSchedule = editedItems.map((ei) => ({ label: ei.title, percent: ei.description ? Number(ei.description) : undefined }))
                  setLocalProposals((prev) =>
                    prev.map((p) =>
                      p.id === viewing.id ? { ...p, payment_schedule: updatedSchedule } : p
                    )
                  )
                  await supabase
                    .from('proposals')
                    .update({ payment_schedule: updatedSchedule, updated_at: new Date().toISOString() })
                    .eq('id', viewing.id as string)
                }}
                isEditable={true}
                showPromoteOption={true}
              />
            </Card>
          )
        })()}

        {/* Our Recent Work */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <ImageIcon size={11} className="inline mr-1" />
              Our Recent Work
            </p>
            <button className="text-[11px] text-[var(--navy)] font-semibold">
              Add portfolio photos
            </button>
          </div>
          <div className="text-center py-4">
            <p className="text-xs text-[var(--text-tertiary)]">Add portfolio photos to showcase your work in proposals.</p>
          </div>
        </Card>

        {/* Footer */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[var(--text-secondary)]">Duration</p>
            <p className="text-sm font-semibold text-[var(--text)]">{String(viewing.duration ?? '')}</p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-light)]">
            <p className="font-semibold text-[var(--text)]">Total Investment</p>
            <p className="font-mono text-xl font-bold text-[var(--navy)]">${((viewing.total_price as number) ?? 0).toLocaleString()}</p>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          {viewing.status === 'sent' && (
            <>
              <Button fullWidth>
                <Send size={16} />
                Send Follow-Up
              </Button>
              <Button variant="secondary" fullWidth>
                <Eye size={16} />
                Preview as Client
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load proposals. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  )

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Proposals"
        subtitle={`${proposals.length} proposals`}
        action={
          <Button size="sm" onClick={() => setShowNewForm(true)}>
            <Plus size={15} />
            New Proposal
          </Button>
        }
      />

      {/* New Proposal Modal */}
      {showNewForm && <NewProposalModal
        onClose={() => setShowNewForm(false)}
        saving={saving}
        setSaving={setSaving}
        refetch={refetch}
        setSelected={setSelected}
      />}

      {isLoading ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 rounded-full bg-[var(--rust-subtle)] flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-[var(--rust)]" />
          </div>
          <p className="font-medium text-sm text-[var(--text)]">No proposals yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-4">Start an AI site walk to generate your first proposal, or create one manually.</p>
          <Button size="sm" onClick={() => setShowNewForm(true)}>
            <Plus size={15} />
            New Proposal
          </Button>
        </div>
      ) : (
        <Card padding="none">
          {proposals.map(prop => (
            <button
              key={prop.id as string}
              onClick={() => setSelected(prop.id as string)}
              className="w-full flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 text-left active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--text)] truncate">{String(prop.title ?? '')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{String(prop.client_name ?? '')} — {String(prop.project_type ?? '')}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={prop.status as string} />
                  {!!prop.sent_at && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">Sent {String(prop.sent_at)}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-sm font-bold text-[var(--text)]">
                  {(() => {
                    const price = (prop.total_price as number) ?? 0
                    return price >= 1000
                      ? `$${(price / 1000).toFixed(0)}K`
                      : `$${price.toLocaleString()}`
                  })()}
                </p>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] mt-1 ml-auto" />
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}

function NewProposalModal({
  onClose,
  saving,
  setSaving,
  refetch,
  setSelected,
}: {
  onClose: () => void
  saving: boolean
  setSaving: (v: boolean) => void
  refetch: () => void
  setSelected: (id: string) => void
}) {
  const [projects, setProjects] = useState<{ id: string; title: string; client_name: string; address: string; project_type: string }[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, title, client_name, address, project_type')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setProjects(data as typeof projects)
      })
  }, [])

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId)
    if (!projectId) return
    const proj = projects.find(p => p.id === projectId)
    if (!proj) return
    const form = document.getElementById('new-proposal-form') as HTMLFormElement
    if (!form) return
    const titleInput = form.elements.namedItem('title') as HTMLInputElement
    const nameInput = form.elements.namedItem('client_name') as HTMLInputElement
    const addressInput = form.elements.namedItem('client_address') as HTMLInputElement
    const typeSelect = form.elements.namedItem('project_type') as HTMLSelectElement
    if (titleInput && !titleInput.value) titleInput.value = proj.title || ''
    if (nameInput && !nameInput.value) nameInput.value = proj.client_name || ''
    if (addressInput && !addressInput.value) addressInput.value = proj.address || ''
    if (typeSelect) {
      const matchType = PROJECT_TYPES.find(t => t.toLowerCase().includes((proj.project_type || '').toLowerCase()))
      if (matchType) typeSelect.value = matchType
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-[var(--navy)]">New Proposal</h2>
          <button onClick={onClose} className="p-1 text-[var(--text-tertiary)]"><X size={18} /></button>
        </div>

        {/* Pre-fill from project */}
        {projects.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Pre-fill from Project</label>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectSelect(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
            >
              <option value="">— Start from scratch —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title} — {p.client_name}</option>
              ))}
            </select>
          </div>
        )}

        <form
          id="new-proposal-form"
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const title = (fd.get('title') as string).trim()
            const clientName = (fd.get('client_name') as string).trim()
            const projectType = fd.get('project_type') as string
            const totalPrice = parseFloat(fd.get('total_price') as string) || 0
            if (!title || !clientName) return
            setSaving(true)
            const { data, error: insertErr } = await supabase.from('proposals').insert({
              title,
              client_name: clientName,
              client_address: (fd.get('client_address') as string).trim() || null,
              project_type: projectType,
              total_price: totalPrice,
              status: 'draft',
              sections: [],
              overview_body: (fd.get('overview') as string).trim() || null,
              duration: (fd.get('duration') as string).trim() || null,
            }).select().single()
            setSaving(false)
            if (insertErr) {
              alert('Error creating proposal: ' + insertErr.message)
              return
            }
            onClose()
            refetch()
            if (data) setSelected(data.id)
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Proposal Title *</label>
            <input name="title" required placeholder="e.g. Kitchen Renovation — Smith Residence" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Client Name *</label>
            <input name="client_name" required placeholder="John Smith" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Client Address</label>
            <input name="client_address" placeholder="123 Main St, City, OH" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Project Type</label>
              <select name="project_type" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20">
                {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Duration</label>
              <input name="duration" placeholder="8–12 weeks" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Total Price ($)</label>
            <input name="total_price" type="number" step="0.01" min="0" placeholder="25000" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Overview</label>
            <textarea name="overview" rows={3} placeholder="Brief project description..." className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
            <Button type="submit" fullWidth disabled={saving}>{saving ? 'Creating…' : 'Create Proposal'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
