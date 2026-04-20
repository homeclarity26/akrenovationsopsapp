import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBackNavigation } from '@/hooks/useBackNavigation'
import { usePickableProjects } from '@/hooks/usePickableProjects'

// Notes == Daily Logs. Adam: "Notes and Flagged items are two different
// things." The earlier version of this page hosted a Flag Change button +
// flagged-items list alongside daily logs, which was confusing — Flag
// Change lives at its own /employee/change-order page (tile on the home
// screen, dedicated FlagChangeOrderPage). Keep this page focused on logs.

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

  const { data: logs = [] } = useQuery({
    queryKey: ['daily-logs', user?.id, selectedProjectId],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from('daily_logs')
        .select('*')
        .eq('employee_id', user!.id)
        .order('log_date', { ascending: false })
        .limit(20)
      if (selectedProjectId) q = q.eq('project_id', selectedProjectId)
      const { data } = await q
      return data ?? []
    },
  })

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
      <div className="pt-2 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1">
          <ArrowLeft size={20} className="text-[var(--navy)]" />
        </button>
        <h1 className="font-display text-2xl text-[var(--navy)]">Notes</h1>
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
