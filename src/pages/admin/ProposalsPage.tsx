import { useState } from 'react'
import { Plus, Eye, Send, ChevronRight, Image as ImageIcon, Star } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EditableDeliverable } from '@/components/ui/EditableDeliverable'
import type { EditableItem } from '@/components/ui/EditableDeliverable'
import { MOCK_PROPOSALS, MOCK_PORTFOLIO_PHOTOS } from '@/data/mock'

export function ProposalsPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [proposals, setProposals] = useState(MOCK_PROPOSALS)

  const viewing = proposals.find(p => p.id === selected)

  if (viewing) {
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
            <h1 className="font-display text-2xl text-[var(--navy)] leading-tight">{viewing.title}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{viewing.client_name}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl font-bold text-[var(--text)]">${(viewing.total_price/1000).toFixed(0)}K</p>
            <StatusPill status={viewing.status} />
          </div>
        </div>

        {/* Overview */}
        {viewing.overview_body && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Project Overview</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{viewing.overview_body}</p>
          </Card>
        )}

        {/* Scope sections */}
        {viewing.sections.map((section, i) => (
          <Card key={i}>
            <p className="font-semibold text-sm text-[var(--text)] mb-2">{section.title}</p>
            <EditableDeliverable
              deliverableType="proposal"
              instanceId={viewing.id}
              instanceTable="proposals"
              items={section.bullets.map((b: string, j: number): EditableItem => ({ id: String(j), title: b }))}
              onSave={async (editedItems) => {
                setProposals((prev) =>
                  prev.map((p) =>
                    p.id === viewing.id
                      ? {
                          ...p,
                          sections: p.sections.map((s, si) =>
                            si === i ? { ...s, bullets: editedItems.map((ei) => ei.title) } : s,
                          ),
                        }
                      : p,
                  ),
                )
              }}
              isEditable={true}
              showPromoteOption={true}
            />
          </Card>
        ))}

        {/* N39: Payment Schedule — milestones editable via EditableDeliverable */}
        {(() => {
          // Cast to access optional payment_schedule field not yet in all mock proposals
          const paymentSchedule = (viewing as typeof viewing & { payment_schedule?: { label?: string; name?: string; percent?: number }[] }).payment_schedule
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
                  instanceId={viewing.id}
                  instanceTable="proposals"
                  items={milestoneItems}
                  onSave={async (editedItems) => {
                    setProposals((prev) =>
                      prev.map((p) =>
                        p.id === viewing.id
                          ? { ...p, payment_schedule: editedItems.map((ei) => ({ label: ei.title, percent: ei.description ? Number(ei.description) : undefined })) }
                          : p
                      )
                    )
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
                instanceId={viewing.id}
                instanceTable="proposals"
                items={[]}
                onSave={async (editedItems) => {
                  setProposals((prev) =>
                    prev.map((p) =>
                      p.id === viewing.id
                        ? { ...p, payment_schedule: editedItems.map((ei) => ({ label: ei.title, percent: ei.description ? Number(ei.description) : undefined })) }
                        : p
                    )
                  )
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
          <div className="grid grid-cols-3 gap-2">
            {MOCK_PORTFOLIO_PHOTOS.slice(0, 3).map((p) => (
              <div key={p.id} className="aspect-square rounded-lg bg-[var(--bg)] overflow-hidden relative">
                <img src={p.image_url} alt={p.caption} className="w-full h-full object-cover" />
                {p.featured && (
                  <Star size={10} className="absolute top-1 right-1 text-[var(--rust)] fill-[var(--rust)]" />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[var(--text-secondary)]">Duration</p>
            <p className="text-sm font-semibold text-[var(--text)]">{viewing.duration}</p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-light)]">
            <p className="font-semibold text-[var(--text)]">Total Investment</p>
            <p className="font-mono text-xl font-bold text-[var(--navy)]">${viewing.total_price.toLocaleString()}</p>
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

      <Card padding="none">
        {proposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">No proposals yet.</div>
        ) : (
          proposals.map(prop => (
            <button
              key={prop.id}
              onClick={() => setSelected(prop.id)}
              className="w-full flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0 text-left active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--text)] truncate">{prop.title}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{prop.client_name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={prop.status} />
                  <span className="text-[11px] text-[var(--text-tertiary)]">Sent {prop.sent_at}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-sm font-bold text-[var(--text)]">${(prop.total_price/1000).toFixed(0)}K</p>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] mt-1 ml-auto" />
              </div>
            </button>
          ))
        )}
      </Card>
    </div>
  )
}
