import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Send, Check, AlertTriangle, Shield } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import type { SubContract, SubContractStatus } from '@/data/mock'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const statusMap: Record<SubContractStatus, string> = {
  draft: 'draft',
  attorney_review: 'proposal_sent',
  approved: 'accepted',
  sent: 'sent',
  signed: 'signed',
  voided: 'cancelled',
}

export function SubContractPage() {
  const { id: projectId, subId: scopeId } = useParams<{ id: string; subId: string }>()
  const navigate = useNavigate()

  const { data: scope, isLoading: scopeLoading, error: scopeError, refetch: scopeRefetch } = useQuery({
    queryKey: ['sub_scope', scopeId],
    enabled: !!scopeId,
    queryFn: async () => {
      const { data } = await supabase.from('sub_scopes').select('*').eq('id', scopeId!).single()
      return data as import('@/data/mock').SubScope | null
    },
  })

  const { data: existing } = useQuery({
    queryKey: ['sub_contract_for_scope', scopeId],
    enabled: !!scopeId,
    queryFn: async () => {
      const { data } = await supabase.from('sub_contracts').select('*').eq('scope_id', scopeId!).maybeSingle()
      return data as SubContract | null
    },
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, title, address').eq('id', projectId).single()
      return data
    },
  })

  const { data: sub } = useQuery({
    queryKey: ['subcontractor', scope?.subcontractor_id],
    enabled: !!scope?.subcontractor_id,
    queryFn: async () => {
      const { data } = await supabase.from('subcontractors').select('id, company_name, contact_name, phone').eq('id', scope!.subcontractor_id!).single()
      return data
    },
  })

  const [contract, setContract] = useState<SubContract | undefined>(undefined)
  // Sync existing contract from DB into local state once
  if (existing !== undefined && contract === undefined) {
    setContract(existing ?? undefined)
  }

  if (scopeLoading || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    )
  }

  if (scopeError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load contract. Check your connection and try again.</p>
      <button onClick={() => scopeRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (!scope) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Scope not found.</p>
      </div>
    )
  }

  const handleGenerate = () => {
    // In production: supabase.functions.invoke('agent-generate-contract', ...)
    const newContract: SubContract = {
      id: `sc-new-${Date.now()}`,
      project_id: scope.project_id,
      scope_id: scope.id,
      subcontractor_id: scope.subcontractor_id ?? 'sub-2',
      budget_quote_id: scope.budget_quote_id,
      contract_number: `SC-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
      revision: 1,
      contract_amount: scope.scope_sections.header.contract_amount,
      payment_schedule: [
        { milestone: 'Mobilization', amount: Math.round(scope.scope_sections.header.contract_amount * 0.4), due_condition: 'Upon mobilization to site' },
        { milestone: 'Mid-project', amount: Math.round(scope.scope_sections.header.contract_amount * 0.4), due_condition: 'At 50% completion of scope' },
        { milestone: 'Final', amount: Math.round(scope.scope_sections.header.contract_amount * 0.2), due_condition: 'Upon substantial completion' },
      ],
      retention_percent: 10,
      start_date: scope.scope_sections.schedule.mobilization_date,
      completion_date: scope.scope_sections.schedule.substantial_completion,
      liquidated_damages_per_day: null,
      required_gl_amount: 1000000,
      required_wc: true,
      additional_insured: true,
      template_version: 'v1.0-draft',
      status: 'draft',
      attorney_approved_template: false,
      attorney_reviewed: false,
      sub_signed_at: null,
      akr_signed_at: null,
      created_at: new Date().toISOString(),
    }
    setContract(newContract)
  }

  const handleExportAttorney = () => {
    if (!contract) return
    setContract({ ...contract, status: 'attorney_review' })
    alert('DOCX exported to Google Drive → Attorney Review → Sub Contract Templates')
  }

  const handleSend = () => {
    if (!contract) return
    if (!confirm(`Send contract to ${sub?.company_name ?? 'subcontractor'} for signature?`)) return
    setContract({ ...contract, status: 'sent' })
  }

  const handleSign = () => {
    if (!contract) return
    setContract({ ...contract, status: 'signed', sub_signed_at: new Date().toISOString(), akr_signed_at: new Date().toISOString() })
  }

  const dollarStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

  // No contract yet
  if (!contract) {
    return (
      <div className="max-w-3xl mx-auto lg:px-8 lg:py-6 px-4 pt-4 pb-24 space-y-4">
        <button
          onClick={() => navigate(`/admin/projects/${projectId}/subs/${scope.id}/scope`)}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to scope
        </button>

        <PageHeader title="Generate Subcontractor Contract" subtitle={`For scope ${scope.scope_number}`} />

        <Card>
          <p className="text-sm text-[var(--text)]">
            This generates a subcontractor agreement using the currently approved contract template. The legal language comes from the template, only the project-specific fields change.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Scope</div>
              <div>{scope.scope_number}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Sub</div>
              <div>{scope.scope_sections.header.subcontractor}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Amount</div>
              <div className="font-mono" style={dollarStyle}>${scope.scope_sections.header.contract_amount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Template</div>
              <div>v1.0-draft</div>
            </div>
          </div>
          <Button className="mt-4" onClick={handleGenerate}>Generate Contract</Button>
        </Card>
      </div>
    )
  }

  const totalSchedule = contract.payment_schedule.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="max-w-3xl mx-auto lg:px-8 lg:py-6 px-4 pt-4 pb-24 space-y-4">
      <button
        onClick={() => navigate(`/admin/projects/${projectId}/subs/${scope.id}/scope`)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to scope
      </button>

      <PageHeader
        title={contract.contract_number}
        subtitle={`${scope.trade} · ${scope.scope_sections.header.subcontractor}`}
        action={<StatusPill status={statusMap[contract.status]} />}
      />

      {/* Template badge */}
      {contract.attorney_approved_template ? (
        <Card className="bg-[var(--success-bg)] border-[var(--success)]/30">
          <p className="text-sm text-[var(--success)] font-medium flex items-center gap-2">
            <Shield size={14} />
            Attorney-approved template {contract.template_version}
          </p>
        </Card>
      ) : (
        <Card className="bg-[var(--warning-bg)] border-[var(--warning)]/30">
          <p className="text-sm text-[var(--warning)] font-medium flex items-center gap-2">
            <AlertTriangle size={14} />
            Pending attorney review, template {contract.template_version}
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button variant="secondary" size="sm" onClick={() => alert('PDF queued')}>
          <Download size={14} />
          PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportAttorney}>
          <FileText size={14} />
          Attorney
        </Button>
        {['draft', 'attorney_review', 'approved'].includes(contract.status) && (
          <Button variant="secondary" size="sm" onClick={handleSend}>
            <Send size={14} />
            Send to Sub
          </Button>
        )}
        {['sent'].includes(contract.status) && (
          <Button variant="secondary" size="sm" onClick={handleSign}>
            <Check size={14} />
            Mark Signed
          </Button>
        )}
      </div>

      {/* Scope reference */}
      <Card>
        <SectionHeader title="Scope of Work Reference" />
        <p className="mt-2 text-sm text-[var(--text)]">
          This Agreement incorporates by reference the Scope of Work document titled
          <strong> Scope of Work — {scope.trade} — {project.title} </strong>
          (Scope No. {scope.scope_number}, dated {new Date(scope.created_at).toLocaleDateString()}),
          which is attached hereto as Exhibit A and made a part of this Agreement.
        </p>
      </Card>

      {/* Parties */}
      <Card>
        <SectionHeader title="Parties" />
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Contractor</div>
            <div>AK Renovations LLC</div>
            <div className="text-[var(--text-secondary)]">Adam Kilgore, Owner</div>
            <div className="text-[var(--text-secondary)]">Summit County, Ohio</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Subcontractor</div>
            <div>{sub?.company_name ?? scope.scope_sections.header.subcontractor}</div>
            <div className="text-[var(--text-secondary)]">{sub?.contact_name ?? '—'}</div>
            <div className="text-[var(--text-secondary)]">{sub?.phone ?? ''}</div>
          </div>
        </div>
      </Card>

      {/* Amount */}
      <Card>
        <SectionHeader title="Contract Amount" />
        <div className="mt-2 flex justify-between items-baseline">
          <span className="text-sm text-[var(--text-secondary)]">Total</span>
          <span className="font-mono text-2xl font-display text-[var(--navy)]" style={dollarStyle}>
            ${contract.contract_amount.toLocaleString()}
          </span>
        </div>
      </Card>

      {/* Payment schedule */}
      <Card>
        <SectionHeader title="Payment Schedule" />
        <div className="mt-2 space-y-2">
          {contract.payment_schedule.map((m, i) => (
            <div key={i} className="flex justify-between items-start text-sm py-2 border-b border-[var(--border-light)] last:border-0">
              <div>
                <div className="font-medium">{m.milestone}</div>
                <div className="text-[var(--text-secondary)] text-xs mt-0.5">{m.due_condition}</div>
              </div>
              <div className="font-mono font-medium" style={dollarStyle}>${m.amount.toLocaleString()}</div>
            </div>
          ))}
          <div className="flex justify-between items-center text-sm pt-2">
            <span className="text-[var(--text-secondary)]">Schedule total</span>
            <span className="font-mono font-medium" style={dollarStyle}>${totalSchedule.toLocaleString()}</span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-2">
            Retention of {contract.retention_percent}% withheld from each payment, released at project closeout.
          </div>
        </div>
      </Card>

      {/* Insurance */}
      <Card>
        <SectionHeader title="Insurance Requirements" />
        <ul className="mt-2 space-y-1 text-sm">
          <li>- Commercial General Liability: minimum <span className="font-mono">${contract.required_gl_amount.toLocaleString()}</span> per occurrence</li>
          <li>- Workers Compensation: {contract.required_wc ? 'required per Ohio law' : 'waived'}</li>
          <li>- Automobile Liability: minimum <span className="font-mono">$1,000,000</span> combined single limit</li>
          {contract.additional_insured && <li>- AK Renovations LLC named as Additional Insured on all policies</li>}
        </ul>
      </Card>

      {/* Schedule */}
      <Card>
        <SectionHeader title="Schedule" />
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Start</div>
            <div>{contract.start_date ?? '[TO BE CONFIRMED]'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Completion</div>
            <div>{contract.completion_date ?? '[TO BE CONFIRMED]'}</div>
          </div>
        </div>
      </Card>

      {/* Legal notice */}
      <Card>
        <SectionHeader title="Legal Framework" />
        <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
          Contract governed by Ohio law. Includes: Ohio Mechanic Lien Rights (ORC Chapter 1311),
          indemnification, independent contractor status, dispute resolution via Summit County mediation,
          termination for convenience and cause. Full legal text comes from template {contract.template_version}.
          No changes to legal language without attorney approval.
        </p>
      </Card>

      {/* Signatures */}
      {contract.status === 'signed' && (
        <Card className="bg-[var(--success-bg)] border-[var(--success)]/30">
          <div className="flex items-start gap-3">
            <Check size={20} className="text-[var(--success)] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-[var(--success)]">Contract fully signed</div>
              <div className="text-[var(--text-secondary)] mt-1">
                Sub signed {contract.sub_signed_at ? new Date(contract.sub_signed_at).toLocaleDateString() : ''}
                {' · '}
                AKR signed {contract.akr_signed_at ? new Date(contract.akr_signed_at).toLocaleDateString() : ''}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
