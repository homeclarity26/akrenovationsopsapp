import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Phone, Mail, Check, Shield, HardHat, Eye,
  FileText, Image as ImageIcon, ClipboardList, Users, LayoutDashboard,
  Activity as ActivityIcon, Plus, AlertCircle,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { useProjectRealtime } from '@/hooks/useProjectRealtime'
import { ProjectActivityFeed } from '@/components/project/ProjectActivityFeed'
import { ProjectPresenceBar } from '@/components/project/ProjectPresenceBar'

type Tab = 'overview' | 'team' | 'tasks' | 'logs' | 'photos' | 'activity'

type AssignmentRole = 'foreman' | 'worker' | 'observer' | 'crew'

interface AssignmentRow {
  id: string
  employee_id: string
  role: AssignmentRole
  active: boolean
  profile: {
    id: string
    full_name: string | null
    email: string | null
  } | null
}

const ROLE_META: Record<Exclude<AssignmentRole, 'crew'>, { label: string; Icon: typeof Shield }> = {
  foreman:  { label: 'Foreman',  Icon: Shield },
  worker:   { label: 'Worker',   Icon: HardHat },
  observer: { label: 'Observer', Icon: Eye },
}

/**
 * Field-mode project detail page. Read-mostly — shows the info a worker
 * on-site actually needs (teammates, tasks, logs, photos, live activity)
 * without any admin-only controls. Task checkbox writes are allowed only
 * for the logged-in employee's own tasks; RLS enforces this server-side.
 */
export function EmployeeProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  // Subscribe to realtime so every panel updates live as teammates + admins work.
  useProjectRealtime(id)

  const { data: project, isLoading: projectLoading, error: projectError, refetch: projectRefetch } = useQuery({
    queryKey: ['project', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: phases = [] } = useQuery({
    queryKey: ['project_phases', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('project_phases').select('*').eq('project_id', id).order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: assignments = [] } = useQuery<AssignmentRow[]>({
    queryKey: ['project_assignments', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('id, employee_id, role, active, profile:profiles!project_assignments_employee_id_fkey(id, full_name, email)')
        .eq('project_id', id)
        .eq('active', true)
        .order('assigned_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as AssignmentRow[]
    },
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['project_tasks', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('sort_order', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['project_daily_logs', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('project_id', id)
        .order('log_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: projectPhotos = [] } = useQuery({
    queryKey: ['project_photos', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_photos')
        .select('*')
        .eq('project_id', id)
        .order('taken_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  if (projectLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-tertiary)] text-sm">Loading project…</p>
      </div>
    )
  }

  if (projectError) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Unable to load project. You may not have access, or the connection dropped.
        </p>
        <button
          onClick={() => projectRefetch()}
          className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Project not found.</p>
      </div>
    )
  }

  const openTasks = (tasks as Array<{ status: string }>).filter(t => t.status !== 'done').length

  const TABS: { id: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'team',     label: `Team${assignments.length ? ` (${assignments.length})` : ''}`, Icon: Users },
    { id: 'tasks',    label: `Tasks${openTasks ? ` (${openTasks})` : ''}`, Icon: ClipboardList },
    { id: 'logs',     label: 'Logs',     Icon: FileText },
    { id: 'photos',   label: `Photos${projectPhotos.length ? ` (${projectPhotos.length})` : ''}`, Icon: ImageIcon },
    { id: 'activity', label: 'Activity', Icon: ActivityIcon },
  ]

  const addressForMaps = project.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`
    : null

  // Toggle a task between todo and done. RLS only allows the employee the
  // task is assigned to; we still gate it client-side so the checkbox is
  // inert for tasks that aren't mine.
  const toggleTask = async (taskId: string, currentStatus: string, assignedTo: string | null) => {
    if (!user || assignedTo !== user.id) return
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done'
    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', taskId)
    if (error) {
      // Realtime will undo the optimistic state — nothing to do
      console.error('Failed to update task', error)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['project_tasks', id] })
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border-light)]">
        <button
          onClick={() => navigate('/employee/projects')}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={15} />
          Projects
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-[var(--navy)] leading-tight">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {project.status && <StatusPill status={project.status} />}
              {project.schedule_status && <StatusPill status={project.schedule_status} />}
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
                title="This page updates live as your team makes changes"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--success)] opacity-60 animate-ping" />
                  <span className="relative rounded-full bg-[var(--success)] h-1.5 w-1.5" />
                </span>
                Live
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {id && <ProjectPresenceBar projectId={id} />}
          </div>
        </div>

        {/* Progress bar */}
        {project.status === 'active' && typeof project.percent_complete === 'number' && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${project.percent_complete}%` }} />
            </div>
            <span className="text-xs font-mono text-[var(--text-tertiary)]">{project.percent_complete}%</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border-light)] px-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all',
              tab === t.id
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            {/* Client + address */}
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Client</p>
              {project.client_name && <p className="font-semibold text-[var(--text)]">{project.client_name}</p>}
              <div className="space-y-2 mt-3">
                {project.client_phone && (
                  <a href={`tel:${project.client_phone}`} className="flex items-center gap-2">
                    <Phone size={13} className="text-[var(--text-tertiary)] flex-shrink-0" />
                    <p className="text-sm text-[var(--text-secondary)]">{project.client_phone}</p>
                  </a>
                )}
                {project.client_email && (
                  <a href={`mailto:${project.client_email}`} className="flex items-center gap-2">
                    <Mail size={13} className="text-[var(--text-tertiary)] flex-shrink-0" />
                    <p className="text-sm text-[var(--text-secondary)] truncate">{project.client_email}</p>
                  </a>
                )}
                {project.address && (
                  addressForMaps ? (
                    <a
                      href={addressForMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2"
                    >
                      <MapPin size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[var(--navy)] underline">{project.address}</p>
                    </a>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[var(--text-secondary)]">{project.address}</p>
                    </div>
                  )
                )}
              </div>
            </Card>

            {/* Phases */}
            {phases.length > 0 && (
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">Phases</p>
                <div className="space-y-3">
                  {(phases as Array<{ id: string; name: string; status: string; percent_complete: number | null }>).map(phase => (
                    <div key={phase.id} className="flex items-center gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                        phase.status === 'complete' ? 'bg-[var(--success)]' :
                        phase.status === 'active' ? 'bg-[var(--navy)]' :
                        'bg-[var(--border-light)]',
                      )}>
                        {phase.status === 'complete' && <Check size={12} className="text-white" />}
                        {phase.status === 'active' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', phase.status === 'upcoming' ? 'text-[var(--text-tertiary)]' : 'font-medium text-[var(--text)]')}>
                          {phase.name}
                        </p>
                        {phase.status === 'active' && (phase.percent_complete ?? 0) > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-[var(--border-light)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${phase.percent_complete ?? 0}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{phase.percent_complete ?? 0}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Key dates */}
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Dates</p>
              <div className="space-y-2">
                {project.estimated_start_date && (
                  <div className="flex justify-between">
                    <p className="text-sm text-[var(--text-secondary)]">Start date</p>
                    <p className="text-sm font-semibold text-[var(--text)]">{project.estimated_start_date}</p>
                  </div>
                )}
                {project.target_completion_date && (
                  <div className="flex justify-between">
                    <p className="text-sm text-[var(--text-secondary)]">Target completion</p>
                    <p className="text-sm font-semibold text-[var(--text)]">{project.target_completion_date}</p>
                  </div>
                )}
                {typeof project.estimated_duration_weeks === 'number' && (
                  <div className="flex justify-between">
                    <p className="text-sm text-[var(--text-secondary)]">Duration</p>
                    <p className="text-sm font-semibold text-[var(--text)]">{project.estimated_duration_weeks} weeks</p>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        {/* ── TEAM ── */}
        {tab === 'team' && (
          <Card padding="none">
            {assignments.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
                No one is assigned to this project yet.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-light)]">
                {assignments.map(a => {
                  const roleKey = (a.role === 'crew' ? 'worker' : a.role) as keyof typeof ROLE_META
                  const meta = ROLE_META[roleKey]
                  const RoleIcon = meta?.Icon ?? HardHat
                  const name = a.profile?.full_name ?? a.profile?.email ?? 'Team member'
                  return (
                    <li key={a.id} className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-full bg-[var(--bg)] flex items-center justify-center flex-shrink-0">
                        <RoleIcon size={15} className="text-[var(--navy)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{name}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] capitalize">{meta?.label ?? a.role}</p>
                      </div>
                      {a.employee_id === user?.id && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--navy)] bg-blue-50 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        )}

        {/* ── TASKS ── */}
        {tab === 'tasks' && (
          <Card padding="none">
            {tasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
                No tasks for this project.
              </div>
            ) : (
              (tasks as Array<{ id: string; title: string; status: string; priority: string; due_date: string | null; assigned_to: string | null }>).map(task => {
                const mine = task.assigned_to === user?.id
                return (
                  <div key={task.id} className="flex items-start gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id, task.status, task.assigned_to)}
                      disabled={!mine}
                      title={mine ? 'Mark done' : 'Only the assigned teammate can change this task'}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                        task.status === 'done' ? 'bg-[var(--success)] border-[var(--success)]' :
                        task.status === 'in_progress' ? 'border-[var(--navy)]' :
                        'border-[var(--border)]',
                        mine ? 'cursor-pointer hover:border-[var(--navy)]' : 'cursor-not-allowed opacity-70',
                      )}
                    >
                      {task.status === 'done' && <Check size={11} className="text-white" />}
                      {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-[var(--navy)]" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        task.status === 'done' ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text)]',
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                          task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          task.priority === 'high'   ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-600',
                        )}>
                          {task.priority}
                        </span>
                        {task.due_date && <p className="text-[11px] text-[var(--text-tertiary)]">Due {task.due_date}</p>}
                        {mine && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--navy)]">
                            Yours
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </Card>
        )}

        {/* ── LOGS ── */}
        {tab === 'logs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Daily logs
              </p>
              <Link to="/employee/notes">
                <Button size="sm">
                  <Plus size={13} />
                  Add log
                </Button>
              </Link>
            </div>
            {logs.length === 0 ? (
              <Card>
                <p className="text-center text-sm text-[var(--text-tertiary)]">
                  No logs yet. Tap "Add log" to capture today's work.
                </p>
              </Card>
            ) : (
              (logs as Array<{ id: string; log_date: string; weather: string | null; summary: string; workers_on_site: string[] | null }>).map(log => (
                <Card key={log.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-semibold text-sm text-[var(--text)]">{log.log_date}</p>
                    {log.weather && <span className="text-xs text-[var(--text-tertiary)]">· {log.weather}</span>}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{log.summary}</p>
                  {log.workers_on_site && log.workers_on_site.length > 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">{log.workers_on_site.join(', ')}</p>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── PHOTOS ── */}
        {tab === 'photos' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {projectPhotos.length} photo{projectPhotos.length === 1 ? '' : 's'}
              </p>
              <Link to="/employee/photos">
                <Button size="sm">
                  <Plus size={13} />
                  Upload
                </Button>
              </Link>
            </div>
            {projectPhotos.length === 0 ? (
              <Card>
                <p className="text-center text-sm text-[var(--text-tertiary)] py-4">
                  No photos yet. Use the Photos page to upload progress shots.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(projectPhotos as Array<{ id: string; image_url: string; caption: string | null }>).map(p => (
                  <Card key={p.id} padding="none">
                    <div className="aspect-[4/3] rounded-t-xl overflow-hidden bg-[var(--bg)]">
                      <img
                        src={p.image_url}
                        alt={p.caption ?? ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {p.caption && (
                      <div className="p-2.5">
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{p.caption}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {tab === 'activity' && id && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Live project activity — every edit, log, and team change as it happens.
            </p>
            <ProjectActivityFeed projectId={id} />
            <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 justify-center pt-2">
              <AlertCircle size={11} />
              Activity is read-only for field crew.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
