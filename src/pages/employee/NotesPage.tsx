import { useEffect, useState } from 'react'
import { ArrowLeft, Flag, FileText, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBackNavigation } from '@/hooks/useBackNavigation'
import { usePickableProjects } from '@/hooks/usePickableProjects'


export function NotesPage() {
  const { user } = useAuth()
  const goBack = useBackNavigation('/employee')
  const queryClient = useQueryClient()

  // Persist last-used project
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem('ak_notes_project') ?? '')
  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id)
    localStorage.setItem('ak_notes_project', id)
  }

  const [showFlag, setShowFlag] = useState(false)
  const [flagText, setFlagText] = useState('')
  const [submittingFlag, setSubmittingFlag] = useState(false)

  const [showLog, setShowLog] = useState(false)
  const [logSummary, setLogSummary] = useState('')
  const [logWork, setLogWork] = useState('')
  const [logIssues, setLogIssues] = useState('')
  const [logWeather, setLogWeather] = useState('')
  const [submittingLog, setSubmittingLog] = useState(false)

  const { data: projects = [], error: projectsError, refetch: projectsRefetch } = usePickableProjects()

  // Reset selectedProjectId if it's not in the projects list
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId && !projects.find(p => p.id === selectedProjectId)) {
      handleProjectChange('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects])

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
        id: co.id, project_id: co.project_id, title: co.title,
        description: co.description, status: co.status,
        cost_change: co.cost_change ?? 0,
        flagged_at: co.flagged_at ? new Date(co.flagged_at).toLocaleDateString() : '',
      }))
    },
  })

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

  const submitFlag = async () => {
    if (!flagText.trim() || !selectedProjectId || !user) return
    setSubmittingFlag(true)
    await supabase.from('change_orders').insert({
      project_id: selectedProjectId,
      title: flagText.slice(0, 100),
      description: flagText,
      status: 'flagged',
      flagged_by: user.id,
      flagged_at: new Date().toISOString(),
      cost_change: 0,
      schedule_change_days: 0,
    })
    queryClient.invalidateQueries({ queryKey: ['change-orders-flagged', user.id] })
    setFlagText('')
    setShowFlag(false)
    setSubmittingFlag(false)
  }

  const submitLog = async () => {
    if (!logSummary.trim() || !selectedProjectId || !user) return
    setSubmittingLog(true)
    await supabase.from('daily_logs').insert({
      project_id: selectedProjectId,
      employee_id: user.id,
      log_date: new Date().toISOString().slice(0, 10),
      summary: logSummary,
      work_completed: logWork || null,
      issues: logIssues || null,
      weather: logWeather || null,
      ai_generated: false,
    })
    queryClient.invalidateQueries({ queryKey: ['daily-logs', user.id] })
    setLogSummary(''); setLogWork(''); setLogIssues(''); setLogWeather('')
    setShowLog(false)
    setSubmittingLog(false)
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  if (projectsError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load notes. Check your connection and try again.</p>
      <button onClick={() => projectsRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-[var(--navy)]" />
          </button>
          <h1 className="font-display text-2xl text-[var(--navy)]">Notes</h1>
        </div>
        <button
          onClick={() => setShowFlag(true)}
          disabled={!selectedProjectId}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--rust)] text-white text-sm font-semibold disabled:opacity-40"
        >
          <Flag size={14} />Flag Change
        </button>
      </div>

      {/* Project selector */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] block mb-2">Project</label>
        <select
          className="w-full px-3 py-3 rounded-xl border border-[var(--border)] text-sm bg-white text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
          value={selectedProjectId}
          onChange={e => handleProjectChange(e.target.value)}
        >
          <option value="">Select a project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>

      {/* Flag modal */}
      {showFlag && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text)] mb-1">Flag Potential Change Order</p>
          {selectedProject && <p className="text-xs text-[var(--text-tertiary)] mb-3">{selectedProject.title}</p>}
          <textarea
            className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none"
            rows={3}
            placeholder="Describe what changed or the issue you found..."
            value={flagText}
            onChange={e => setFlagText(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={submitFlag} disabled={submittingFlag || !flagText.trim()} className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold disabled:opacity-40">
              {submittingFlag ? 'Submitting...' : 'Submit Flag'}
            </button>
            <button onClick={() => { setShowFlag(false); setFlagText('') }} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)]">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Log modal */}
      {showLog && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text)] mb-1">Add Today's Log</p>
          {selectedProject && <p className="text-xs text-[var(--text-tertiary)] mb-3">{selectedProject.title}</p>}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Summary *</label>
              <textarea className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] resize-none" rows={3} placeholder="What was accomplished today?" value={logSummary} onChange={e => setLogSummary(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Work Completed</label>
              <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" placeholder="e.g. framing, tile, demo" value={logWork} onChange={e => setLogWork(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Issues</label>
                <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" placeholder="Any problems?" value={logIssues} onChange={e => setLogIssues(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Weather</label>
                <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]" placeholder="e.g. sunny, 65°" value={logWeather} onChange={e => setLogWeather(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={submitLog} disabled={submittingLog || !logSummary.trim()} className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold disabled:opacity-40">
              {submittingLog ? 'Saving...' : 'Save Log'}
            </button>
            <button onClick={() => setShowLog(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)]">Cancel</button>
          </div>
        </Card>
      )}

      {/* Flagged items */}
      {dbFlags.length > 0 && (
        <div>
          <SectionHeader title="Flagged Items" />
          <Card padding="none">
            {dbFlags.map((co: any) => (
              <div key={co.id} className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--rust-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Flag size={14} className="text-[var(--rust)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{co.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{co.flagged_at}</p>
                  {co.cost_change > 0 && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">+${co.cost_change.toLocaleString()}</p>}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0 ${co.status === 'approved' ? 'bg-[var(--success-bg)] text-[var(--success)]' : co.status === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-[var(--warning-bg)] text-[var(--warning)]'}`}>
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
          <Card><p className="text-sm text-[var(--text-secondary)] text-center py-4">No daily logs yet.</p></Card>
        ) : (
          <Card padding="none">
            {(logs as any[]).map((log) => (
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

      <button
        onClick={() => setShowLog(true)}
        disabled={!selectedProjectId}
        className="w-full py-3.5 rounded-xl border border-[var(--border)] flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--white)] disabled:opacity-40"
      >
        <Plus size={16} />Add Today's Log
      </button>
    </div>
  )
}
