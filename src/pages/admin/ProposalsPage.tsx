import { useState, useEffect } from 'react'
import { Plus, Eye, Send, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EditableDeliverable } from '@/components/ui/EditableDeliverable'
import type { EditableItem } from '@/components/ui/EditableDeliverable'
import { supabase } from '@/lib/supabase'

type ProposalRecord = Record<string, unknown>

export function ProposalsPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [localProposals, setLocalProposals] = useState<ProposalRecord[]>([])

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

  // Seed local state from fetched data (allows in-memory edits without re-fetching)
  useEffect(() => {
    if (fetchedProposals.length > 0 && localProposals.length === 0) {
      setLocalProposals(fetchedProposals)
    }
  }, [fetchedProposals, localProposals.length])

  const proposals = localProposals.length > 0 ? localProposals : fetchedProposals

  const viewing = proposals.find(p => p.id === selected) ?? null

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

        {/* N39: Payment Schedule — milestones editable via EditableDeliverable */}
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
          // No payment schedule exists yet — show placeholder
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

        {/* Our Recent Work — auto-suggested portfolio photos for this project type */}
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
            <p className="font-mono text-xl font-bold text-[var(--navy)]">${(viewing.total_price as number).toLocaleString()}</p>
          </div>
        </Card>

        {/* Actions */}
        {viewing.status === 'sent' && (
          <div className="space-y-2">
            <Button fullWidth>
              <Send size={16} />
              Send Follow-Up
            </Button>
            <Button variant="secondary" fullWidth>
              <Eye size={16} />
              Preview as Client
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load proposals. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Proposals"
        subtitle={`${proposals.length} proposals`}
        action={
          <Button size="sm">
            <Plus size={15} />
            New Proposal
          </Button>
        }
      />

      {isLoading ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">Loading...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="font-medium text-sm text-[var(--text)]">No proposals yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Start an AI site walk to generate your first proposal.</p>
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
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{String(prop.client_name ?? '')}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={prop.status as string} />
                  {!!prop.sent_at && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">Sent {String(prop.sent_at)}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-sm font-bold text-[var(--text)]">${((prop.total_price as number) / 1000).toFixed(0)}K</p>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] mt-1 ml-auto" />
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
