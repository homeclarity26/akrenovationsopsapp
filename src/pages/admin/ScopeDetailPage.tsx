import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Send, RefreshCw, Check, Edit3, FilePlus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import {
  MOCK_SUB_SCOPES,
  MOCK_PROJECTS,
  MOCK_SUBCONTRACTORS,
  MOCK_SUB_CONTRACTS,
} from '@/data/mock'
import type { SubScope, SubScopeStatus } from '@/data/mock'

const statusMap: Record<SubScopeStatus, string> = {
  draft: 'draft',
  reviewed: 'accepted',
  sent: 'sent',
  acknowledged: 'signed',
  superseded: 'cancelled',
}

export function ScopeDetailPage() {
  const { id: projectId, subId: scopeId } = useParams<{ id: string; subId: string }>()
  const navigate = useNavigate()

  const scopeBase = MOCK_SUB_SCOPES.find((s) => s.id === scopeId)
  const project = MOCK_PROJECTS.find((p) => p.id === projectId)
  const [scope, setScope] = useState<SubScope | undefined>(scopeBase)

  if (!scope || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Scope not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(`/admin/projects/${projectId}`)}>
          Back to project
        </Button>
      </div>
    )
  }

  const sub = MOCK_SUBCONTRACTORS.find((s) => s.id === scope.subcontractor_id)
  const subName = sub?.company_name ?? scope.scope_sections.header.subcontractor ?? 'TBD'
  const sections = scope.scope_sections
  const existingContract = MOCK_SUB_CONTRACTS.find((c) => c.scope_id === scope.id)

  const canGenerateContract = ['reviewed', 'sent', 'acknowledged'].includes(scope.status)

  const handleRegenerate = () => {
    if (!confirm('This will create Revision ' + (scope.revision + 1) + ' and archive Revision ' + scope.revision + '. Continue?')) return
    setScope({ ...scope, revision: scope.revision + 1, status: 'draft' })
  }

  const handleMarkReviewed = () => {
    setScope({ ...scope, status: 'reviewed' })
  }

  const handleSendToSub = () => {
    if (!confirm(`Send this scope to ${subName} via email?`)) return
    setScope({ ...scope, status: 'sent' })
  }

  const handleMarkAttorneyReviewed = () => {
    setScope({
      ...scope,
      attorney_reviewed: true,
      attorney_reviewed_at: new Date().toISOString(),
    })
  }

  const handleGenerateContract = () => {
    if (!canGenerateContract) return
    // In production: supabase.functions.invoke('agent-generate-contract', ...)
    navigate(`/admin/projects/${projectId}/subs/${scope.id}/contract`)
  }

  const dollarStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

  return (
    <div className="max-w-3xl mx-auto lg:max-w-none lg:px-8 lg:py-6 px-4 pt-4 pb-24 space-y-4">
      <button
        onClick={() => navigate(`/admin/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to {project.title}
      </button>

      <PageHeader
        title={`${scope.scope_number}`}
        subtitle={`${scope.trade} · ${subName} · Rev ${scope.revision}`}
        action={<StatusPill status={statusMap[scope.status]} />}
      />

      {/* Draft banner */}
      {scope.status === 'draft' && (
        <Card className="bg-[var(--warning-bg)] border-[var(--warning)]/30">
          <p className="text-sm text-[var(--warning)] font-medium">
            AI-generated draft, review before sending to subcontractor
          </p>
        </Card>
      )}

      {scope.attorney_reviewed && (
        <Card className="bg-[var(--success-bg)] border-[var(--success)]/30">
          <p className="text-sm text-[var(--success)] font-medium flex items-center gap-2">
            <Check size={14} />
            Attorney reviewed
            {scope.attorney_reviewed_at ? ` · ${new Date(scope.attorney_reviewed_at).toLocaleDateString()}` : ''}
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Button variant="secondary" size="sm" onClick={handleRegenerate}>
          <RefreshCw size={14} />
          Regenerate
        </Button>
        <Button variant="secondary" size="sm" onClick={() => alert('PDF generation queued')}>
          <Download size={14} />
          PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={() => alert('DOCX exported to Google Drive attorney folder')}>
          <FileText size={14} />
          Attorney
        </Button>
        {scope.status === 'draft' && (
          <Button variant="secondary" size="sm" onClick={handleMarkReviewed}>
            <Check size={14} />
            Mark Reviewed
          </Button>
        )}
        {scope.status !== 'draft' && (
          <Button variant="secondary" size="sm" onClick={handleSendToSub}>
            <Send size={14} />
            Send to Sub
          </Button>
        )}
        {!scope.attorney_reviewed && (
          <Button variant="secondary" size="sm" onClick={handleMarkAttorneyReviewed}>
            <Check size={14} />
            Attorney Ok
          </Button>
        )}
      </div>

      {/* Header info */}
      <Card>
        <SectionHeader title="Document Header" />
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Project</div>
            <div>{sections.header.project_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Address</div>
            <div>{sections.header.project_address}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Client</div>
            <div>{sections.header.client_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Trade</div>
            <div>{sections.header.trade}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Subcontractor</div>
            <div>{sections.header.subcontractor}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Contract Amount</div>
            <div className="font-mono" style={dollarStyle}>${sections.header.contract_amount.toLocaleString()}</div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <SectionCard title="Scope Summary" body={sections.scope_summary} />

      {/* Inclusions */}
      <ListSectionCard title="Inclusions" items={sections.inclusions} bullet="green" />

      {/* Exclusions */}
      <ListSectionCard title="Exclusions" items={sections.exclusions} bullet="red" />

      {/* Materials */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeader title="Materials Responsibility" />
          <Button size="sm" variant="ghost" onClick={() => alert('Edit dialog')}>
            <Edit3 size={12} />
            Edit
          </Button>
        </div>
        <div className="mt-2 space-y-3 text-sm">
          <MaterialsBlock label="Furnished by Subcontractor" items={sections.materials.furnished_by_sub} />
          <MaterialsBlock label="Furnished by AK Renovations" items={sections.materials.furnished_by_akr} />
          {sections.materials.client_selections.length > 0 && (
            <MaterialsBlock label="Client Selections" items={sections.materials.client_selections} />
          )}
        </div>
      </Card>

      {/* Quality */}
      <ListSectionCard title="Quality Standards" items={sections.quality_standards} bullet="navy" />
      {/* Coordination */}
      <ListSectionCard title="Coordination Requirements" items={sections.coordination_requirements} bullet="navy" />
      {/* Inspections */}
      <ListSectionCard title="Inspection Requirements" items={sections.inspection_requirements} bullet="navy" />

      {/* Schedule */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeader title="Schedule" />
          <Button size="sm" variant="ghost" onClick={() => alert('Edit dialog')}>
            <Edit3 size={12} />
            Edit
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Mobilization</div>
            <div>{sections.schedule.mobilization_date}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Substantial Completion</div>
            <div>{sections.schedule.substantial_completion}</div>
          </div>
        </div>
        {sections.schedule.milestones.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--text-secondary)]">
            {sections.schedule.milestones.map((m, i) => (
              <li key={i} className="flex gap-2"><span className="text-[var(--text-tertiary)]">-</span>{m}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Payment Terms */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionHeader title="Payment Terms" />
          <Button size="sm" variant="ghost" onClick={() => alert('Edit dialog')}>
            <Edit3 size={12} />
            Edit
          </Button>
        </div>
        <div className="mt-2 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Total</span>
            <span className="font-mono font-medium" style={dollarStyle}>${sections.payment_terms.total_amount.toLocaleString()}</span>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Schedule</div>
            <div>{sections.payment_terms.schedule}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Retention</div>
            <div>{sections.payment_terms.retention}</div>
          </div>
        </div>
      </Card>

      {/* Special conditions */}
      {sections.special_conditions.length > 0 && (
        <ListSectionCard title="Special Conditions" items={sections.special_conditions} bullet="navy" />
      )}

      {/* Contract generation */}
      <Card className="border-[var(--navy)]/20 bg-[var(--cream-light)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-display text-lg text-[var(--navy)]">Subcontractor Contract</div>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {existingContract
                ? `${existingContract.contract_number} already generated.`
                : canGenerateContract
                  ? 'Scope is reviewed. Ready to generate the subcontractor agreement.'
                  : 'Mark this scope reviewed before generating a contract.'}
            </p>
          </div>
          <Button onClick={handleGenerateContract} disabled={!canGenerateContract && !existingContract}>
            <FilePlus size={14} />
            {existingContract ? 'View Contract' : 'Generate Contract'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function SectionCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionHeader title={title} />
        <Button size="sm" variant="ghost" onClick={() => alert('Edit dialog')}>
          <Edit3 size={12} />
          Edit
        </Button>
      </div>
      <p className="mt-2 text-sm text-[var(--text)] leading-relaxed">{body}</p>
    </Card>
  )
}

function ListSectionCard({ title, items, bullet }: { title: string; items: string[]; bullet: 'green' | 'red' | 'navy' }) {
  const colorClass =
    bullet === 'green' ? 'bg-[var(--success)]' : bullet === 'red' ? 'bg-[var(--danger)]' : 'bg-[var(--navy)]'
  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionHeader title={title} />
        <Button size="sm" variant="ghost" onClick={() => alert('Edit dialog')}>
          <Edit3 size={12} />
          Edit
        </Button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-[var(--text)]">
            <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${colorClass}`} />
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function MaterialsBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider mb-1">{label}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[var(--text)]">- {item}</li>
        ))}
      </ul>
    </div>
  )
}
