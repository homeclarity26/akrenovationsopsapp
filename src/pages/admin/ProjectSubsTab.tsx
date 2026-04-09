import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FilePlus, ChevronRight, Sparkles, AlertTriangle, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import type { SubScopeStatus } from '@/data/mock'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Props {
  projectId: string
}

const scopeStatusLabel: Record<SubScopeStatus, string> = {
  draft: 'draft',
  reviewed: 'accepted',
  sent: 'sent',
  acknowledged: 'signed',
  superseded: 'cancelled',
}

export function ProjectSubsTab({ projectId }: Props) {
  const navigate = useNavigate()
  const [generating, setGenerating] = useState<string | null>(null)

  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      const { data } = await supabase.from('subcontractors').select('id, company_name, contact_name, phone')
      return (data ?? []) as { id: string; company_name: string; contact_name?: string; phone?: string }[]
    },
  })

  const { data: awardedQuotes = [], error: quotesError, refetch: quotesRefetch } = useQuery({
    queryKey: ['budget_quotes', projectId, 'awarded'],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('budget_quotes')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'awarded')
      return (data ?? []) as {
        id: string
        project_id: string
        trade_id: string
        subcontractor_id: string
        company_name: string
        amount: number
        status: string
      }[]
    },
  })

  const { data: scopes = [] } = useQuery({
    queryKey: ['sub_scopes', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('sub_scopes')
        .select('*')
        .eq('project_id', projectId)
      return (data ?? []) as { id: string; project_id: string; budget_quote_id: string | null; scope_number: string; status: SubScopeStatus; [key: string]: unknown }[]
    },
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['sub_contracts', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('sub_contracts')
        .select('*')
        .eq('project_id', projectId)
      return (data ?? []) as { id: string; project_id: string; scope_id: string; contract_number: string; status: string; attorney_approved_template: boolean; [key: string]: unknown }[]
    },
  })

  const { data: trades = [] } = useQuery({
    queryKey: ['budget_trades'],
    queryFn: async () => {
      const { data } = await supabase.from('budget_trades').select('id, name')
      return (data ?? []) as { id: string; name: string }[]
    },
  })

  // Memoize scope/contract lookups
  const scopesByQuoteId = useMemo(() => {
    const map = new Map<string, typeof scopes[0]>()
    for (const s of scopes) {
      if (s.budget_quote_id) map.set(s.budget_quote_id, s)
    }
    return map
  }, [scopes])

  const contractsByScopeId = useMemo(() => {
    const map = new Map<string, typeof contracts[0]>()
    for (const c of contracts) {
      map.set(c.scope_id, c)
    }
    return map
  }, [contracts])

  if (quotesError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load subcontractor data. Check your connection and try again.</p>
      <button onClick={() => quotesRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (awardedQuotes.length === 0) {
    return (
      <Card>
        <div className="text-center py-6 space-y-2">
          <FileText size={24} className="mx-auto text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">No subs awarded yet.</p>
          <p className="text-xs text-[var(--text-tertiary)]">Award a quote in the Budget tab to begin generating scopes and contracts.</p>
        </div>
      </Card>
    )
  }

  const handleGenerateScope = (quoteId: string) => {
    setGenerating(quoteId)
    // In production: supabase.functions.invoke('agent-generate-scope', { ... })
    setTimeout(() => {
      setGenerating(null)
      alert('Scope generation would now run agent-generate-scope edge function and then route to the scope page.')
    }, 600)
  }

  const dollarStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

  return (
    <div className="space-y-4">
      <SectionHeader title="Awarded Subcontractors" />

      {awardedQuotes.map((quote) => {
        const trade = trades.find((t) => t.id === quote.trade_id)
        const sub = subcontractors.find((s) => s.id === quote.subcontractor_id)
        const scope = scopesByQuoteId.get(quote.id)
        const contract = scope ? contractsByScopeId.get(scope.id) : null

        return (
          <Card key={quote.id}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-medium text-[15px]">{trade?.name ?? 'Trade'}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {sub?.company_name ?? quote.company_name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-lg font-medium" style={dollarStyle}>
                  ${quote.amount.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wider">Awarded</div>
              </div>
            </div>

            {/* Scope row */}
            <div className="flex items-center justify-between py-2.5 border-t border-[var(--border-light)]">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[var(--text-tertiary)]" />
                <span className="text-sm font-medium">Scope of Work</span>
                {scope && <StatusPill status={scopeStatusLabel[scope.status]} />}
              </div>
              {scope ? (
                <button
                  onClick={() => navigate(`/admin/projects/${projectId}/subs/${scope.id}/scope`)}
                  className="text-sm text-[var(--navy)] hover:underline flex items-center gap-1"
                >
                  {scope.scope_number}
                  <ChevronRight size={14} />
                </button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleGenerateScope(quote.id)}
                  disabled={generating === quote.id}
                >
                  <Sparkles size={13} />
                  {generating === quote.id ? 'Generating...' : 'Generate Scope'}
                </Button>
              )}
            </div>

            {/* Contract row */}
            <div className="flex items-center justify-between py-2.5 border-t border-[var(--border-light)]">
              <div className="flex items-center gap-2">
                <FilePlus size={14} className="text-[var(--text-tertiary)]" />
                <span className="text-sm font-medium">Contract</span>
                {contract && (
                  <>
                    <StatusPill status={contract.status === 'signed' ? 'signed' : contract.status === 'sent' ? 'sent' : 'draft'} />
                    {contract.attorney_approved_template ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--success)]">
                        <Check size={10} />
                        Template approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--warning)]">
                        <AlertTriangle size={10} />
                        Template pending
                      </span>
                    )}
                  </>
                )}
              </div>
              {contract ? (
                <button
                  onClick={() => navigate(`/admin/projects/${projectId}/subs/${scope?.id}/contract`)}
                  className="text-sm text-[var(--navy)] hover:underline flex items-center gap-1"
                >
                  {contract.contract_number}
                  <ChevronRight size={14} />
                </button>
              ) : scope && ['reviewed', 'sent', 'acknowledged'].includes(scope.status) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/admin/projects/${projectId}/subs/${scope.id}/contract`)}
                >
                  <FilePlus size={13} />
                  Generate
                </Button>
              ) : (
                <span className="text-xs text-[var(--text-tertiary)]">
                  {scope ? 'Review scope first' : 'Need scope first'}
                </span>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
