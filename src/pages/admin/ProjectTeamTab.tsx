import { useState } from 'react'
import { UserPlus, X, Shield, HardHat, Eye } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'

interface Props {
  projectId: string
}

type AssignmentRole = 'foreman' | 'worker' | 'observer'

interface AssignmentRow {
  id: string
  employee_id: string
  role: AssignmentRole | 'crew'
  active: boolean
  assigned_at: string
  profile: {
    id: string
    full_name: string | null
    email: string | null
    role: string | null
  } | null
}

interface EmployeeOption {
  id: string
  full_name: string | null
  email: string | null
}

const ROLE_META: Record<AssignmentRole, { label: string; Icon: typeof Shield; desc: string }> = {
  foreman:  { label: 'Foreman',  Icon: Shield,  desc: 'Lead on-site decisions + full edit access' },
  worker:   { label: 'Worker',   Icon: HardHat, desc: 'Standard field access to logs, photos, shopping list' },
  observer: { label: 'Observer', Icon: Eye,     desc: 'Read-only — can view project but not edit' },
}

export function ProjectTeamTab({ projectId }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRole, setPickerRole] = useState<AssignmentRole>('worker')
  const [pickerEmployee, setPickerEmployee] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const {
    data: assignments = [],
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery<AssignmentRow[]>({
    queryKey: ['project_assignments', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('id, employee_id, role, active, assigned_at, profile:profiles!project_assignments_employee_id_fkey(id, full_name, email, role)')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('assigned_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as AssignmentRow[]
    },
  })

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ['employees-for-assignment', user?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['employee', 'admin'])
        .order('full_name')
      if (error) throw error
      return (data ?? []) as EmployeeOption[]
    },
  })

  const assignedIds = new Set(assignments.map(a => a.employee_id))
  const availableEmployees = employees.filter(e => !assignedIds.has(e.id))

  const addAssignment = async () => {
    if (!pickerEmployee || !user) return
    setSubmitting(true)
    // UPSERT on (project_id, employee_id): if a soft-removed row exists, flip active=true
    const { error } = await supabase
      .from('project_assignments')
      .upsert(
        {
          project_id: projectId,
          employee_id: pickerEmployee,
          role: pickerRole,
          assigned_by: user.id,
          active: true,
        },
        { onConflict: 'project_id,employee_id' },
      )
    setSubmitting(false)
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['project_assignments', projectId] })
      toast.success('Team member added')
      setPickerOpen(false)
      setPickerEmployee('')
      setPickerRole('worker')
    }
  }

  const updateRole = async (assignmentId: string, role: AssignmentRole) => {
    const { error } = await supabase
      .from('project_assignments')
      .update({ role })
      .eq('id', assignmentId)
    if (!error) queryClient.invalidateQueries({ queryKey: ['project_assignments', projectId] })
  }

  const removeAssignment = async (assignmentId: string) => {
    // Soft-remove: keep the row for history, flip active=false
    const { error } = await supabase
      .from('project_assignments')
      .update({ active: false })
      .eq('id', assignmentId)
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['project_assignments', projectId] })
      toast.info('Team member removed')
    }
  }

  if (assignmentsError) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load team. Check your connection and try again.</p>
        <Button size="sm" onClick={() => refetchAssignments()}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Assigned Team" />
        <Button size="sm" onClick={() => setPickerOpen(true)} disabled={availableEmployees.length === 0}>
          <UserPlus size={13} />
          Assign
        </Button>
      </div>

      {pickerOpen && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text)] mb-3">Assign someone to this project</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Employee</label>
              <select
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                value={pickerEmployee}
                onChange={e => setPickerEmployee(e.target.value)}
              >
                <option value="">Select employee...</option>
                {availableEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.full_name ?? e.email ?? e.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] block mb-2">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(ROLE_META) as AssignmentRole[]).map(r => {
                  const { label, Icon } = ROLE_META[r]
                  const selected = pickerRole === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setPickerRole(r)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${
                        selected
                          ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-2">{ROLE_META[pickerRole].desc}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={addAssignment}
                disabled={!pickerEmployee || submitting}
              >
                {submitting ? 'Adding...' : 'Add to team'}
              </Button>
              <button
                onClick={() => { setPickerOpen(false); setPickerEmployee('') }}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {assignments.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">
            No one assigned to this project yet. Assign a foreman and crew so they can see it in Field mode.
          </p>
        </Card>
      ) : (
        <Card padding="none">
          {assignments.map(a => {
            const effectiveRole: AssignmentRole = a.role === 'crew' ? 'worker' : a.role
            const { Icon } = ROLE_META[effectiveRole]
            const displayName = a.profile?.full_name ?? a.profile?.email ?? 'Unknown'
            return (
              <div key={a.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="w-10 h-10 rounded-full bg-[var(--navy)] text-white flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)] truncate">{displayName}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate">{a.profile?.email ?? ''}</p>
                </div>
                <select
                  value={effectiveRole}
                  onChange={e => updateRole(a.id, e.target.value as AssignmentRole)}
                  className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]"
                  aria-label={`Role for ${displayName}`}
                >
                  <option value="foreman">Foreman</option>
                  <option value="worker">Worker</option>
                  <option value="observer">Observer</option>
                </select>
                <button
                  onClick={() => removeAssignment(a.id)}
                  className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                  aria-label={`Remove ${displayName}`}
                  title={`Remove ${displayName}`}
                >
                  <X size={15} />
                </button>
              </div>
            )
          })}
        </Card>
      )}

      <p className="text-[11px] text-[var(--text-tertiary)] px-1">
        Only assigned people (and admins) can see this project in Field mode.
        The assigned role also appears in the realtime project feed once that lands.
      </p>
    </div>
  )
}
