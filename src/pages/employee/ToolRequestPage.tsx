import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wrench, Mic, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function ToolRequestPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects-tool'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title')
        .eq('status', 'active')
        .order('title')
      return data ?? []
    },
  })

  const { data: myRequests = [], error, refetch } = useQuery({
    queryKey: ['tool-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('tool_requests')
        .select('*, projects(title)')
        .eq('employee_id', user!.id)
        .order('submitted_at', { ascending: false })
      return (data ?? []).map((r: any) => ({
        id: r.id,
        tool_name: r.item_name,
        project_title: r.projects?.title ?? '',
        needed_by: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '',
        status: r.status ?? 'pending',
        admin_response: r.reason ?? null,
      }))
    },
  })

  const [toolName, setToolName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [neededBy, setNeededBy] = useState(new Date().toISOString().slice(0, 10))
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load tool requests. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (submitted) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <Card>
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] flex items-center justify-center mb-3">
              <Check size={26} className="text-[var(--success)]" />
            </div>
            <p className="font-display text-xl text-[var(--navy)] mb-1">Got it</p>
            <p className="text-sm text-[var(--text-secondary)]">Adam will see your request and respond soon.</p>
            <Button className="mt-5" onClick={() => navigate('/employee')}>Back to launchpad</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <button
        onClick={() => navigate('/employee')}
        className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-2"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--cream-light)] flex items-center justify-center">
          <Wrench size={18} className="text-[var(--navy)]" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-[var(--navy)]">Request a tool</h1>
          <p className="text-xs text-[var(--text-tertiary)]">Adam will review and respond.</p>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              What tool do you need?
            </label>
            <div className="flex gap-2">
              <Input
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="e.g. 4-foot tile leveling system"
                className="flex-1"
              />
              <button className="p-2.5 border border-[var(--border)] rounded-xl text-[var(--navy)]" type="button">
                <Mic size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              Which project?
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-3 py-2.5 text-sm"
            >
              <option value="">-- Select project --</option>
              {activeProjects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              When do you need it?
            </label>
            <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              Urgency
            </label>
            <div className="flex gap-2">
              {(['normal', 'urgent'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${
                    urgency === u
                      ? u === 'urgent'
                        ? 'bg-[var(--rust)] text-white border-[var(--rust)]'
                        : 'bg-[var(--navy)] text-white border-[var(--navy)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  {u === 'urgent' ? 'Urgent' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 block">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What you'll use it for, specs, etc."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-2xl px-3 py-2.5 text-sm"
            />
          </div>

          <Button
            className="w-full"
            disabled={!toolName.trim()}
            onClick={async () => {
              await supabase.from('tool_requests').insert({
                employee_id: user?.id,
                item_name: toolName,
                project_id: projectId || null,
                reason: notes || null,
                status: 'pending',
                submitted_at: new Date().toISOString(),
              })
              queryClient.invalidateQueries({ queryKey: ['tool-requests', user?.id] })
              setSubmitted(true)
            }}
          >
            Submit request
          </Button>
        </div>
      </Card>

      {myRequests.length === 0 && (
        <div className="mt-2">
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">No tool requests yet.</p>
        </div>
      )}
      {myRequests.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Your recent requests
          </p>
          <Card padding="none">
            {myRequests.map((r: any) => (
              <div key={r.id} className="p-3 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text)]">{r.tool_name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {r.project_title} · need by {r.needed_by}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
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
                {r.admin_response && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5 italic">
                    Adam: {r.admin_response}
                  </p>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
