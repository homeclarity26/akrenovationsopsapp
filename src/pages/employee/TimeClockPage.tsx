import { useState, useEffect } from 'react'
import { Plus, Clock, X, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkType = 'field_carpentry' | 'project_management' | 'site_visit' | 'design' | 'administrative' | 'travel' | 'other'
type BillingStatus = 'pending' | 'invoiced' | 'written_off' | 'na'
type EntryMethod = 'live' | 'manual'

interface TimeEntry {
  id: string
  user_id: string
  project_id: string | null
  project_title: string | null
  work_type: WorkType
  clock_in: string
  clock_out: string | null
  total_minutes: number | null
  is_billable: boolean
  billing_rate: number | null
  billed_amount: number | null
  billing_status: BillingStatus
  entry_method: EntryMethod
  manual_reason?: string
  geofence_verified: boolean
  approved_by?: string | null
  approved_at?: string | null
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  field_carpentry:    'Field Carpentry',
  project_management: 'Project Mgmt',
  site_visit:         'Site Visit',
  design:             'Design',
  administrative:     'Administrative',
  travel:             'Travel',
  other:              'Other',
}

const WORK_TYPE_COLORS: Record<WorkType, string> = {
  field_carpentry:    'bg-orange-100 text-orange-700',
  project_management: 'bg-blue-100 text-blue-700',
  site_visit:         'bg-green-100 text-green-700',
  design:             'bg-purple-100 text-purple-700',
  administrative:     'bg-gray-100 text-gray-600',
  travel:             'bg-teal-100 text-teal-700',
  other:              'bg-gray-100 text-gray-600',
}

const WORK_TYPES: WorkType[] = ['field_carpentry', 'project_management', 'site_visit', 'design', 'administrative', 'travel', 'other']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtHHMMSS(ms: number) {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function fmtTimeRange(clockIn: string, clockOut: string) {
  const fmt = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${fmt(clockIn)} — ${fmt(clockOut)}`
}

function fmtMoney(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TimeClockPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const TODAY = new Date().toISOString().slice(0, 10)

  const { data: dbEntries = [] } = useQuery({
    queryKey: ['today-time-entries', user?.id, TODAY],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*, projects(title)')
        .eq('employee_id', user!.id)
        .gte('clock_in', `${TODAY}T00:00:00`)
        .lte('clock_in', `${TODAY}T23:59:59`)
        .order('clock_in', { ascending: false })
      return (data ?? []).map((e: any) => ({
        ...e,
        user_id: e.employee_id,
        project_title: e.projects?.title ?? null,
        total_minutes: e.total_hours != null ? Math.round(e.total_hours * 60) : null,
        work_type: (e.work_type ?? 'other') as WorkType,
        entry_method: (e.entry_method ?? 'live') as EntryMethod,
        billing_status: (e.billing_status ?? 'na') as BillingStatus,
        is_billable: e.is_billable ?? false,
        billing_rate: e.billing_rate ?? null,
        billed_amount: e.billed_amount ?? null,
      })) as TimeEntry[]
    },
  })

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, client_name')
        .eq('status', 'active')
        .order('title')
      return data ?? []
    },
  })

  const [now, setNow] = useState(Date.now())
  const [showClockIn, setShowClockIn] = useState(false)
  const [showClockOut, setShowClockOut] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const [clockOutNote, setClockOutNote] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Clock-in flow state
  const [ciStep, setCiStep] = useState<1 | 2 | 3>(1)
  const [ciProject, setCiProject] = useState<{ id: string; title: string } | null>(null)
  const [ciWorkType, setCiWorkType] = useState<WorkType>('field_carpentry')
  const [ciBillable, setCiBillable] = useState(true)
  const [ciRate, setCiRate] = useState(85)
  const [projectSearch, setProjectSearch] = useState('')

  // Manual entry state
  const [manualDate, setManualDate] = useState(TODAY)
  const [manualProject, setManualProject] = useState<{ id: string; title: string } | null>(null)
  const [manualWorkType, setManualWorkType] = useState<WorkType>('field_carpentry')
  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualBillable, setManualBillable] = useState(true)
  const [manualRate, setManualRate] = useState(85)
  const [manualReason, setManualReason] = useState('')
  const [manualError, setManualError] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const todayEntries = dbEntries.filter(e =>
    e.clock_in.startsWith(TODAY)
  )
  const openEntry = todayEntries.find(e => e.clock_out === null)
  const closedEntries = todayEntries.filter(e => e.clock_out !== null)

  const totalMinutesToday = closedEntries.reduce((sum, e) => sum + (e.total_minutes ?? 0), 0)
  const openMins = openEntry ? Math.floor((now - new Date(openEntry.clock_in).getTime()) / 60000) : 0
  const grandTotalMins = totalMinutesToday + openMins

  const billableMins = closedEntries.filter(e => e.is_billable).reduce((sum, e) => sum + (e.total_minutes ?? 0), 0)
  const totalBilled = closedEntries.reduce((sum, e) => sum + (e.billed_amount ?? 0), 0)

  const filteredProjects = activeProjects.filter((p: any) =>
    p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(projectSearch.toLowerCase())
  )

  // ── Clock In ─────────────────────────────────────────────────────────────────
  const handleClockInTap = () => {
    if (openEntry) {
      setShowConflict(true)
    } else {
      setCiStep(1)
      setCiProject(null)
      setProjectSearch('')
      setShowClockIn(true)
    }
  }

  const handleClockInConfirm = () => {
    const doInsert = async (coords: { lat: number; lng: number } | null) => {
      await supabase.from('time_entries').insert({
        employee_id: user!.id,
        project_id: ciProject?.id ?? null,
        clock_in: new Date().toISOString(),
        clock_in_lat: coords?.lat ?? null,
        clock_in_lng: coords?.lng ?? null,
        entry_type: 'live',
        work_type: ciWorkType,
        is_billable: ciProject ? ciBillable : false,
        billing_rate: ciProject && ciBillable ? ciRate : null,
        billing_status: ciProject && ciBillable ? 'pending' : 'na',
        notes: null,
      })
      queryClient.invalidateQueries({ queryKey: ['today-time-entries'] })
    }

    setShowClockIn(false)
    setCiStep(1)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        doInsert({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { doInsert(null) },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  // ── Clock Out ─────────────────────────────────────────────────────────────────
  const handleClockOutConfirm = () => {
    if (!openEntry) return

    const doUpdate = async (coords: { lat: number; lng: number } | null) => {
      const clockOutTime = new Date()
      const totalHours = (clockOutTime.getTime() - new Date(openEntry.clock_in).getTime()) / 3600000
      await supabase.from('time_entries').update({
        clock_out: clockOutTime.toISOString(),
        clock_out_lat: coords?.lat ?? null,
        clock_out_lng: coords?.lng ?? null,
        total_hours: Math.round(totalHours * 100) / 100,
        notes: clockOutNote || null,
      }).eq('id', openEntry.id)
      queryClient.invalidateQueries({ queryKey: ['today-time-entries'] })
    }

    setClockOutNote('')
    setShowClockOut(false)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        doUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { doUpdate(null) },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  // ── Manual Entry ─────────────────────────────────────────────────────────────
  const handleManualSave = async () => {
    setManualError('')
    if (!manualProject) { setManualError('Select a project'); return }
    if (!manualStart || !manualEnd) { setManualError('Enter start and end time'); return }
    if (!manualReason.trim()) { setManualError('Reason is required for manual entries'); return }
    const startDt = new Date(`${manualDate}T${manualStart}`)
    const endDt = new Date(`${manualDate}T${manualEnd}`)
    if (endDt <= startDt) { setManualError('End time must be after start time'); return }
    if (endDt > new Date()) { setManualError('Cannot enter future time'); return }
    const totalHours = (endDt.getTime() - startDt.getTime()) / 3600000

    await supabase.from('time_entries').insert({
      employee_id: user!.id,
      project_id: manualProject.id,
      clock_in: startDt.toISOString(),
      clock_out: endDt.toISOString(),
      total_hours: Math.round(totalHours * 100) / 100,
      entry_type: 'manual',
      work_type: manualWorkType,
      is_billable: manualBillable,
      billing_rate: manualBillable ? manualRate : null,
      billing_status: manualBillable ? 'pending' : 'na',
      notes: manualReason,
    })
    queryClient.invalidateQueries({ queryKey: ['today-time-entries'] })

    setShowManual(false)
    setManualReason('')
    setManualStart('')
    setManualEnd('')
  }

  // ── Switch Projects (conflict → clock out current → clock in new) ──────────
  const handleSwitchProject = () => {
    if (!openEntry) return

    const doSwitch = async (coords: { lat: number; lng: number } | null) => {
      const clockOutTime = new Date()
      const totalHours = (clockOutTime.getTime() - new Date(openEntry.clock_in).getTime()) / 3600000
      await supabase.from('time_entries').update({
        clock_out: clockOutTime.toISOString(),
        clock_out_lat: coords?.lat ?? null,
        clock_out_lng: coords?.lng ?? null,
        total_hours: Math.round(totalHours * 100) / 100,
      }).eq('id', openEntry.id)
      queryClient.invalidateQueries({ queryKey: ['today-time-entries'] })
    }

    setShowConflict(false)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        doSwitch({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { doSwitch(null) },
      { enableHighAccuracy: true, timeout: 5000 }
    )

    setTimeout(() => {
      setCiStep(1)
      setCiProject(null)
      setProjectSearch('')
      setShowClockIn(true)
    }, 150)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Back arrow */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] pt-2 px-0 pb-0">
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--navy)]">Time Clock</h1>
          <p className="font-mono text-3xl font-bold text-[var(--text)] mt-1">{fmtDuration(grandTotalMins)}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">today</p>
        </div>
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1.5 text-sm text-[var(--navy)] font-semibold mt-1"
        >
          <Plus size={15} />
          Add past time
        </button>
      </div>

      {/* Active segment card */}
      {openEntry && (
        <div className="rounded-xl border-l-4 border-[var(--rust)] bg-[var(--cream-light)] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[var(--text)]">{openEntry.project_title ?? 'Overhead'}</p>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block mt-1 ${WORK_TYPE_COLORS[openEntry.work_type]}`}>
                {WORK_TYPE_LABELS[openEntry.work_type]}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-2xl font-bold text-[var(--rust)]">{fmtHHMMSS(now - new Date(openEntry.clock_in).getTime())}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {openEntry.is_billable && openEntry.billing_rate
                  ? `$${openEntry.billing_rate}/hr · billable`
                  : 'Not billed'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClockOut(true)}
            className="w-full py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold"
          >
            Clock Out
          </button>
        </div>
      )}

      {/* Today's completed segments */}
      {closedEntries.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">Today's segments</p>
          <Card className="divide-y divide-[var(--border-light)] p-0 overflow-hidden">
            {closedEntries.map(e => (
              <div key={e.id}>
                <button
                  className="w-full text-left p-4 flex items-start justify-between gap-3"
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{e.project_title ?? 'Overhead'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${WORK_TYPE_COLORS[e.work_type]}`}>
                        {WORK_TYPE_LABELS[e.work_type]}
                      </span>
                      {e.entry_method === 'manual' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Manual</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{fmtTimeRange(e.clock_in, e.clock_out!)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold text-[var(--text)]">{fmtDuration(e.total_minutes!)}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {e.billed_amount ? fmtMoney(e.billed_amount) + ' billed' : 'Not billed'}
                    </p>
                  </div>
                </button>
                {expandedId === e.id && (
                  <div className="px-4 pb-4 pt-0 bg-[var(--bg)]">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {e.is_billable && e.billing_rate ? `$${e.billing_rate}/hr · ${fmtMoney(e.billed_amount ?? 0)} total` : 'Not billable'}
                    </p>
                    {e.manual_reason && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">Manual reason: {e.manual_reason}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Day total footer */}
      {(closedEntries.length > 0 || openEntry) && (
        <Card>
          <div className="grid grid-cols-3 divide-x divide-[var(--border-light)]">
            <div className="pr-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Total</p>
              <p className="font-mono text-lg font-bold text-[var(--text)] mt-0.5">{fmtDuration(grandTotalMins)}</p>
            </div>
            <div className="px-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Billable</p>
              <p className="font-mono text-lg font-bold text-[var(--text)] mt-0.5">{fmtDuration(billableMins)}</p>
            </div>
            <div className="pl-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Billed</p>
              <p className="font-mono text-lg font-bold text-[var(--success)] mt-0.5">{fmtMoney(totalBilled)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Clock In button (when not clocked in) */}
      {!openEntry && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <button
            onClick={handleClockInTap}
            className="w-full py-4 rounded-xl bg-[var(--navy)] text-white text-base font-semibold flex items-center justify-center gap-2"
          >
            <Clock size={18} />
            Clock In
          </button>
        </div>
      )}

      {/* ── Clock In Modal ───────────────────────────────────────────────────── */}
      {showClockIn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col">
          <div className="bg-white rounded-t-2xl mt-auto max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-2">
                {ciStep > 1 && (
                  <button onClick={() => setCiStep(s => (s - 1) as 1 | 2 | 3)} className="text-[var(--text-secondary)] text-sm">
                    ← Back
                  </button>
                )}
                <h2 className="font-semibold text-[var(--text)]">
                  {ciStep === 1 ? 'Which project?' : ciStep === 2 ? 'Work type' : 'Billing'}
                </h2>
              </div>
              <button onClick={() => setShowClockIn(false)}>
                <X size={18} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {/* Step 1 — Project selector */}
              {ciStep === 1 && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]"
                    autoFocus
                  />
                  <div className="space-y-2">
                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setCiProject({ id: p.id, title: p.title }); setCiStep(2) }}
                        className="w-full text-left p-3 rounded-xl border border-[var(--border-light)] bg-white hover:border-[var(--navy)] transition-colors"
                      >
                        <p className="font-semibold text-sm text-[var(--text)]">{p.title}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{p.client_name}</p>
                      </button>
                    ))}
                    <button
                      onClick={() => { setCiProject(null); setCiStep(2) }}
                      className="w-full text-left p-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg)]"
                    >
                      <p className="text-sm text-[var(--text-secondary)] font-semibold">No project — overhead / unbillable</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Work type */}
              {ciStep === 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {WORK_TYPES.map(wt => (
                      <button
                        key={wt}
                        onClick={() => { setCiWorkType(wt); setCiStep(3) }}
                        className={`p-3 rounded-xl border text-sm font-semibold text-left transition-colors ${
                          ciWorkType === wt
                            ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                            : 'border-[var(--border)] bg-white text-[var(--text)]'
                        }`}
                      >
                        {WORK_TYPE_LABELS[wt]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3 — Billing + confirm */}
              {ciStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--border-light)] p-4 bg-[var(--bg)]">
                    <p className="text-sm font-semibold text-[var(--text)] mb-1">Selected project</p>
                    <p className="text-sm text-[var(--text-secondary)]">{ciProject?.title ?? 'Overhead / unbillable'}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">{WORK_TYPE_LABELS[ciWorkType]}</p>
                  </div>

                  {ciProject && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-light)] bg-white">
                      <span className="text-sm font-semibold text-[var(--text)]">Bill to project</span>
                      <div className="flex items-center gap-3">
                        {ciBillable && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-[var(--text-tertiary)]">$</span>
                            <input
                              type="number"
                              value={ciRate}
                              onChange={e => setCiRate(Number(e.target.value))}
                              className="w-16 text-right text-sm font-mono font-bold border border-[var(--border)] rounded-lg px-2 py-1 bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]"
                            />
                            <span className="text-xs text-[var(--text-tertiary)]">/hr</span>
                          </div>
                        )}
                        <button
                          onClick={() => setCiBillable(b => !b)}
                          className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${ciBillable ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ciBillable ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleClockInConfirm}
                    className="w-full py-4 rounded-xl bg-[var(--navy)] text-white text-base font-semibold"
                  >
                    Start Clock
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Clock Out Bottom Sheet ────────────────────────────────────────────── */}
      {showClockOut && openEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text)]">Clock out</h2>
              <button onClick={() => setShowClockOut(false)}><X size={18} className="text-[var(--text-secondary)]" /></button>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-[var(--text)]">{openEntry.project_title ?? 'Overhead'}</p>
              <p className="font-mono text-2xl font-bold text-[var(--navy)]">{fmtHHMMSS(now - new Date(openEntry.clock_in).getTime())}</p>
              {openEntry.is_billable && openEntry.billing_rate && (
                <p className="text-sm text-[var(--success)]">
                  {fmtMoney((now - new Date(openEntry.clock_in).getTime()) / 3600000 * openEntry.billing_rate)} billed to project
                </p>
              )}
            </div>
            <textarea
              placeholder="Add a note about this session (optional)"
              value={clockOutNote}
              onChange={e => setClockOutNote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)] resize-none"
              rows={2}
            />
            <button onClick={handleClockOutConfirm} className="w-full py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold">
              Confirm Clock Out
            </button>
            <button onClick={() => setShowClockOut(false)} className="w-full py-3 text-sm text-[var(--text-secondary)]">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Already Clocked In Conflict Sheet ────────────────────────────────── */}
      {showConflict && openEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-4 space-y-4">
            <h2 className="font-semibold text-[var(--text)]">Already clocked in</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              You're clocked in at <strong>{openEntry.project_title ?? 'Overhead'}</strong>. Clock out first, or switch projects.
            </p>
            <button
              onClick={handleSwitchProject}
              className="w-full py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold"
            >
              Clock out of {openEntry.project_title ?? 'Overhead'} &amp; switch
            </button>
            <button
              onClick={() => setShowConflict(false)}
              className="w-full py-3 text-sm text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Manual Entry Form ─────────────────────────────────────────────────── */}
      {showManual && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col">
          <div className="bg-white rounded-t-2xl mt-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
              <h2 className="font-semibold text-[var(--text)]">Add past time</h2>
              <button onClick={() => setShowManual(false)}><X size={18} className="text-[var(--text-secondary)]" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {manualError && (
                <p className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 rounded-xl">{manualError}</p>
              )}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Date</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Project</label>
                <div className="space-y-1.5">
                  {activeProjects.map((p: any) => (
                    <button key={p.id} onClick={() => setManualProject({ id: p.id, title: p.title })}
                      className={`w-full text-left p-3 rounded-xl border text-sm font-semibold transition-colors ${manualProject?.id === p.id ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-[var(--border-light)] text-[var(--text)]'}`}>
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Work type</label>
                <div className="grid grid-cols-2 gap-2">
                  {WORK_TYPES.map(wt => (
                    <button key={wt} onClick={() => setManualWorkType(wt)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors ${manualWorkType === wt ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-[var(--border)] text-[var(--text)]'}`}>
                      {WORK_TYPE_LABELS[wt]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] block mb-1">Start time</label>
                  <input type="time" value={manualStart} onChange={e => setManualStart(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] block mb-1">End time</label>
                  <input type="time" value={manualEnd} onChange={e => setManualEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]" />
                </div>
              </div>
              {manualProject && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-light)] bg-white">
                  <span className="text-sm font-semibold text-[var(--text)]">Bill to project</span>
                  <div className="flex items-center gap-2">
                    {manualBillable && (
                      <input type="number" value={manualRate} onChange={e => setManualRate(Number(e.target.value))}
                        className="w-16 text-right text-sm font-mono border border-[var(--border)] rounded-lg px-2 py-1 bg-[var(--bg)] focus:outline-none" />
                    )}
                    <button onClick={() => setManualBillable(b => !b)}
                      className={`w-11 h-6 rounded-full relative transition-colors ${manualBillable ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${manualBillable ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Reason for manual entry <span className="text-[var(--rust)]">*</span></label>
                <input type="text" placeholder="e.g. Forgot to clock in, phone died..."
                  value={manualReason} onChange={e => setManualReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]" />
              </div>
              <button onClick={handleManualSave} className="w-full py-3 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold">
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
