import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wrench, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function ToolRequestsAdminPage() {
  const navigate = useNavigate()

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['tool-requests-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tool_requests')
        .select('*, profiles:employee_id(full_name)')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto lg:px-8 lg:py-6">
        <div className="text-sm text-[var(--text-secondary)] text-center py-8">Loading tool requests...</div>
      </div>
    )
  }

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
          {pendingCount} pending · review and respond
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">No tool requests yet.</p>
        </Card>
      ) : (
        <Card padding="none">
          {requests.map((r) => {
            const employeeName = (r.profiles as { full_name: string } | null)?.full_name ?? 'Unknown'
            return (
              <div key={r.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--cream-light)]">
                    <Wrench size={16} className="text-[var(--navy)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text)]">{r.item_name}</p>
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
                      {employeeName}
                      {r.vendor && ` · ${r.vendor}`}
                    </p>
                    {r.reason && <p className="text-[11px] text-[var(--text-tertiary)] italic mt-1">{r.reason}</p>}
                    {r.estimated_cost != null && (
                      <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
                        Est. <span className="font-mono">${r.estimated_cost}</span>
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
            )
          })}
        </Card>
      )}
    </div>
  )
}
