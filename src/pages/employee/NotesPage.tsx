import { useState } from 'react'
import { Plus, Flag, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type FlagItem = { id: string; project_id: string; title: string; description: string; status: string; cost_change: number; schedule_change_days: number; flagged_by: string; flagged_at: string; client_approved_at: string | null }

export function NotesPage() {
  const { user } = useAuth()
  const [showFlag, setShowFlag] = useState(false)
  const [flagText, setFlagText] = useState('')
  const [localFlags, setLocalFlags] = useState<FlagItem[]>([])

  const { data: dbFlags = [] } = useQuery({
    queryKey: ['change-orders-flagged', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('change_orders')
        .select('*')
        .eq('flagged_by', user!.id)
        .order('flagged_at', { ascending: false })
      return (data ?? []).map((co: any) => ({
        id: co.id,
        project_id: co.project_id,
        title: co.title,
        description: co.description,
        status: co.status,
        cost_change: co.cost_change ?? 0,
        schedule_change_days: co.schedule_change_days ?? 0,
        flagged_by: co.flagged_by,
        flagged_at: co.flagged_at ? new Date(co.flagged_at).toLocaleDateString() : '',
        client_approved_at: co.client_approved_at ?? null,
      })) as FlagItem[]
    },
  })

  const flags = [...localFlags, ...dbFlags.filter(db => !localFlags.find(l => l.id === db.id))]

  const { data: logs = [] } = useQuery({
    queryKey: ['daily-logs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('employee_id', user!.id)
        .order('log_date', { ascending: false })
        .limit(20)
      return data ?? []
    },
  })

  const submitFlag = () => {
    if (!flagText.trim()) return
    setLocalFlags(prev => [{
      id: `co-${Date.now()}`,
      project_id: '',
      title: flagText,
      description: flagText,
      status: 'flagged' as const,
      cost_change: 0,
      schedule_change_days: 0,
      flagged_by: user?.id ?? '',
      flagged_at: new Date().toLocaleDateString(),
      client_approved_at: null,
    }, ...prev])
    setFlagText('')
    setShowFlag(false)
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 flex items-center justify-between">
        <h1 className="font-display text-2xl text-[var(--navy)]">Notes</h1>
        <button
          onClick={() => setShowFlag(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--rust)] text-white text-sm font-semibold"
        >
          <Flag size={14} />
          Flag Change
        </button>
      </div>

      {/* Flag change order form */}
      {showFlag && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text)] mb-3">Flag Potential Change Order</p>
          <textarea
            className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
            rows={3}
            placeholder="Describe what changed or the issue you found..."
            value={flagText}
            onChange={e => setFlagText(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={submitFlag}
              className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold"
            >
              Submit Flag
            </button>
            <button
              onClick={() => { setShowFlag(false); setFlagText('') }}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Flagged items */}
      {flags.length > 0 && (
        <div>
          <SectionHeader title="Flagged Items" />
          <Card padding="none">
            {flags.map(co => (
              <div key={co.id} className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--rust-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Flag size={14} className="text-[var(--rust)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{co.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{co.flagged_at}</p>
                  {co.cost_change > 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">+${co.cost_change.toLocaleString()}</p>
                  )}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0 ${
                  co.status === 'approved' ? 'bg-[var(--success-bg)] text-[var(--success)]' :
                  co.status === 'sent' ? 'bg-blue-50 text-blue-600' :
                  'bg-[var(--warning-bg)] text-[var(--warning)]'
                }`}>
                  {co.status}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Daily Logs */}
      <div>
        <SectionHeader title="Daily Logs" />
        {logs.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No daily logs yet.</p>
          </Card>
        ) : (
          <Card padding="none">
            {logs.map((log: any) => (
              <div key={log.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--navy)] flex items-center justify-center flex-shrink-0">
                    <FileText size={13} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">{log.log_date}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{log.weather ?? ''}{log.weather ? ' · ' : ''}{log.workers_on_site?.length ?? 0} on site</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{log.summary}</p>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Add log */}
      <button className="w-full py-3.5 rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--white)]">
        <Plus size={16} />
        Add Today's Log
      </button>
    </div>
  )
}
