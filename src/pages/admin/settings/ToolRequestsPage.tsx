import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wrench, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { MOCK_TOOL_REQUESTS } from '@/data/mock'

export function ToolRequestsAdminPage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto lg:px-8 lg:py-6">
      <button
        onClick={() => navigate('/admin/settings')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft size={15} />
        Settings
      </button>

      <div>
        <h1 className="font-display text-3xl text-[var(--navy)]">Tool Requests</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {MOCK_TOOL_REQUESTS.filter((r) => r.status === 'pending').length} pending · review and respond
        </p>
      </div>

      <Card padding="none">
        {MOCK_TOOL_REQUESTS.map((r) => (
          <div key={r.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.urgency === 'urgent' ? 'bg-[var(--rust-subtle)]' : 'bg-[var(--cream-light)]'}`}>
                <Wrench size={16} className={r.urgency === 'urgent' ? 'text-[var(--rust)]' : 'text-[var(--navy)]'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">{r.tool_name}</p>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                      r.status === 'approved'
                        ? 'bg-[var(--success-bg)] text-[var(--success)]'
                        : r.status === 'pending'
                        ? 'bg-[var(--warning-bg)] text-[var(--warning)]'
                        : 'bg-[var(--bg)] text-[var(--text-tertiary)]'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {r.requester_name} for {r.project_title} · need by {r.needed_by}
                </p>
                {r.notes && <p className="text-[11px] text-[var(--text-tertiary)] italic mt-1">{r.notes}</p>}
                {r.estimated_cost != null && (
                  <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
                    Est. <span className="font-mono">${r.estimated_cost}</span>
                    {r.purchase_location && ` · ${r.purchase_location}`}
                  </p>
                )}
                {r.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-[var(--navy)] text-white rounded-lg text-xs font-semibold">
                      <Check size={12} />
                      Approve
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold">
                      <X size={12} />
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
