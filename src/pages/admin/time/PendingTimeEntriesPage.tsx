import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

interface TimeEntry {
  id: string
  employee_id: string
  project_id: string | null
  clock_in: string
  clock_out: string | null
  total_hours: number | null
  entry_method: string
  approved_at: string | null
  notes: string | null
}

function fmtDuration(hours: number | null) {
  if (!hours) return '—'
  const h = Math.floor(hours), m = Math.round((hours - h) * 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function PendingTimeEntriesPage() {
  const { data: dbEntries = [] } = useQuery({
    queryKey: ['pending_time_entries'],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .eq('entry_method', 'manual')
        .is('approved_at', null)
        .order('clock_in', { ascending: false })
      return (data ?? []) as TimeEntry[]
    },
  })

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const entries = dbEntries.filter(e => !removedIds.has(e.id))
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const approve = (id: string) => setRemovedIds(prev => new Set([...prev, id]))
  const reject = (id: string) => { setRemovedIds(prev => new Set([...prev, id])); setRejectId(null); setRejectReason('') }
  const bulkApprove = () => { setRemovedIds(prev => new Set([...prev, ...selected])); setSelected(new Set()) }
  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  if (entries.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Pending Time Entries" subtitle="Manual entries awaiting approval" />
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-[var(--success-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-[var(--success)]" />
          </div>
          <p className="font-semibold text-[var(--text)]">All caught up</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">No manual entries pending review</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader title="Pending Time Entries" subtitle={`${entries.length} manual entr${entries.length === 1 ? 'y' : 'ies'} awaiting approval`} />

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-[var(--navy)] text-white rounded-xl px-4 py-3">
          <p className="text-sm font-semibold">{selected.size} selected</p>
          <button onClick={bulkApprove} className="text-sm font-semibold bg-white text-[var(--navy)] px-3 py-1.5 rounded-lg">
            Approve all
          </button>
        </div>
      )}

      <Card className="p-0 divide-y divide-[var(--border-light)] overflow-hidden">
        {entries.map(e => (
          <div key={e.id} className="p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggleSelect(e.id)}
                className="mt-1 w-4 h-4 accent-[var(--navy)]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{e.employee_id}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{e.project_id ?? 'Overhead'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold text-[var(--text)]">{fmtDuration(e.total_hours)}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{new Date(e.clock_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                {e.notes && (
                  <div className="mt-2 bg-[var(--bg)] rounded-lg px-3 py-2">
                    <p className="text-xs text-[var(--text-secondary)]"><span className="font-semibold">Notes:</span> {e.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => approve(e.id)}
                    className="flex-1 py-2 rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    onClick={() => setRejectId(e.id)}
                    className="flex-1 py-2 rounded-lg bg-[var(--danger-bg)] text-[var(--danger)] text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* Reject reason bottom sheet */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-4 space-y-4">
            <h2 className="font-semibold text-[var(--text)]">Reject entry</h2>
            <textarea
              placeholder="Reason for rejection (required)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)] resize-none"
              rows={3}
            />
            <button
              onClick={() => rejectReason.trim() && reject(rejectId)}
              disabled={!rejectReason.trim()}
              className="w-full py-3 rounded-xl bg-[var(--danger)] text-white text-sm font-semibold disabled:opacity-40"
            >
              Reject Entry
            </button>
            <button onClick={() => setRejectId(null)} className="w-full py-2 text-sm text-[var(--text-secondary)]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
