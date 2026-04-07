import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { MOCK_WARRANTY_PROJECTS, MOCK_WARRANTY_CLAIMS_FULL } from '@/data/mock'

export function WarrantyPage() {
  const navigate = useNavigate()
  const open = MOCK_WARRANTY_CLAIMS_FULL.filter((c) => c.status !== 'resolved' && c.status !== 'denied')

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto lg:px-8 lg:py-6">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </button>

      <div>
        <h1 className="font-display text-3xl text-[var(--navy)]">Warranty</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {MOCK_WARRANTY_PROJECTS.length} active warranties · {open.length} open claim{open.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Active warranties */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          Active warranties
        </p>
        <Card padding="none">
          {MOCK_WARRANTY_PROJECTS.map((p) => {
            const isExpiring = p.days_remaining <= 60
            return (
              <div key={p.project_id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isExpiring ? 'bg-[var(--warning-bg)]' : 'bg-[var(--success-bg)]'}`}>
                    <ShieldCheck size={17} className={isExpiring ? 'text-[var(--warning)]' : 'text-[var(--success)]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)]">{p.project_title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{p.client_name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      Expires {p.warranty_expiry} · {p.days_remaining} days remaining
                    </p>
                  </div>
                  {p.open_claims > 0 && (
                    <span className="text-[10px] font-semibold uppercase bg-[var(--rust-subtle)] text-[var(--rust)] px-2 py-0.5 rounded-full flex-shrink-0">
                      {p.open_claims} open
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      {/* Open claims */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          Open claims
        </p>
        <Card padding="none">
          {open.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No open warranty claims</div>
          ) : (
            open.map((c) => (
              <div key={c.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-mono text-[10px] text-[var(--text-tertiary)]">{c.claim_number}</p>
                  <span className="text-[10px] font-semibold uppercase bg-[var(--warning-bg)] text-[var(--warning)] px-2 py-0.5 rounded-full">
                    {c.status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">{c.description}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {c.project_title} · {c.area} · reported {c.reported_at}
                </p>
                {c.sub_responsible && c.sub_name && (
                  <div className="flex items-center gap-1 mt-2 text-[var(--warning)]">
                    <AlertTriangle size={11} />
                    <p className="text-[11px]">Sub responsible: {c.sub_name}</p>
                  </div>
                )}
                {c.estimated_repair_cost != null && (
                  <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
                    Est. repair ${c.estimated_repair_cost}
                  </p>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
