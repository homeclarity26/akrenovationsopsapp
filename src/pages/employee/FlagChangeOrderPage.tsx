// Field-first "running change order" capture page.
// Employee taps the home tile → picks a project they're assigned to → types
// a short note → hits "Flag it". We insert a change_orders row with status
// 'flagged' and flagged_at = now(). Admin picks it up on the project's
// Changes tab, prices it, and it flows into the next milestone invoice
// through the existing change-order workflow.
//
// Also fires an in-app message to the admin so they see it pop up on their
// device even if they weren't on the Changes tab.

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBackNavigation } from '@/hooks/useBackNavigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'

interface FlaggedChange {
  id: string
  title: string
  description: string
  flagged_at: string | null
  status: string | null
  cost_change: number | null
  projects: { title: string } | null
}

export function FlagChangeOrderPage() {
  const { user } = useAuth()
  const goBack = useBackNavigation('/employee')
  const queryClient = useQueryClient()

  const [projectId, setProjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  // Projects the current user is actually assigned to.
  const { data: projects = [] } = useQuery({
    queryKey: ['my-assigned-projects', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('project_assignments')
        .select('project_id, projects(id, title, client_name, status)')
        .eq('employee_id', user!.id)
      return (data ?? [])
        .map((r: Record<string, unknown>) => r.projects as { id: string; title: string; client_name: string | null; status: string } | null)
        .filter((p): p is { id: string; title: string; client_name: string | null; status: string } => !!p)
        .filter(p => p.status === 'active' || p.status === 'pending')
    },
  })

  // Admins / super_admins can flag on any project — they see the full list.
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-active-projects-for-co', user?.company_id],
    enabled: (user?.role === 'admin' || user?.role === 'super_admin') && !!user?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, client_name, status')
        .in('status', ['active', 'pending'])
        .order('title')
      return (data ?? []) as { id: string; title: string; client_name: string | null; status: string }[]
    },
  })

  const pickableProjects = useMemo(() => {
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
    return isAdmin ? allProjects : projects
  }, [user?.role, allProjects, projects])

  // Recent flagged items on this user's projects — a running list so the
  // field worker can see what they've already sent to the admin today.
  const { data: recent = [], refetch: refetchRecent } = useQuery<FlaggedChange[]>({
    queryKey: ['my-recent-flagged-cos', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('change_orders')
        .select('id, title, description, flagged_at, status, cost_change, projects(title)')
        .eq('flagged_by', user!.id)
        .order('flagged_at', { ascending: false })
        .limit(10)
      return (data ?? []) as unknown as FlaggedChange[]
    },
  })

  // Pre-pick the project if the user only has one assigned.
  useEffect(() => {
    if (!projectId && pickableProjects.length === 1) {
      setProjectId(pickableProjects[0].id)
    }
  }, [pickableProjects, projectId])

  const submit = async () => {
    setError(null)
    if (!projectId) { setError('Pick a project'); return }
    const trimmedTitle = title.trim()
    const trimmedDesc = description.trim()
    if (!trimmedDesc) { setError('Describe what changed'); return }
    setSaving(true)
    const payload = {
      project_id: projectId,
      title: trimmedTitle || trimmedDesc.slice(0, 60),
      description: trimmedDesc,
      flagged_by: user!.id,
      flagged_at: new Date().toISOString(),
      status: 'flagged',
    }
    const { data: inserted, error: insErr } = await supabase
      .from('change_orders')
      .insert(payload)
      .select('id, project_id')
      .single()
    if (insErr) {
      setSaving(false)
      setError(insErr.message)
      return
    }

    // Fire a heads-up message to the project so the admin sees it in Comms
    // without having to navigate to the Changes tab. Best-effort — the
    // change order itself is already persisted and is the source of truth.
    try {
      await supabase.from('messages').insert({
        project_id: inserted?.project_id,
        sender_id: user!.id,
        role: 'system',
        message: `🚨 Change flagged by ${user!.full_name ?? 'field'}: ${trimmedDesc}`,
        message_type: 'change_order_flag',
      })
    } catch {
      // Silent — the change order row is what matters; messages is a nicety.
    }

    setSaving(false)
    setTitle('')
    setDescription('')
    setFlash('Flagged — admin will review')
    setTimeout(() => setFlash(null), 2500)
    queryClient.invalidateQueries({ queryKey: ['my-recent-flagged-cos'] })
    refetchRecent()
  }

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto">
      <button
        onClick={goBack}
        className="text-sm text-[var(--text-secondary)] inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <PageHeader
        title="Flag a change"
        subtitle="Something changed on-site? Send it to the admin so it gets priced and billed."
      />

      <Card>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white"
            >
              <option value="">Select a project…</option>
              {pickableProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.client_name ? ` — ${p.client_name}` : ''}
                </option>
              ))}
            </select>
            {pickableProjects.length === 0 && (
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                You're not assigned to any active projects yet. Ask an admin to add you.
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
              Short title <span className="text-[var(--text-tertiary)] normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Swap vanity for Kohler Devonshire"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1">What changed</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the change, why it came up, and any cost or time impact you already see."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm resize-none"
            />
          </div>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          {flash && (
            <p className="text-xs text-[var(--success)] inline-flex items-center gap-1">
              <Check size={12} /> {flash}
            </p>
          )}
          <Button onClick={submit} disabled={saving || !projectId || !description.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {saving ? 'Flagging…' : 'Flag it'}
          </Button>
        </div>
      </Card>

      {recent.length > 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Recently flagged by you
          </p>
          <div className="space-y-2">
            {recent.map(c => {
              const priced = (c.cost_change ?? 0) !== 0
              return (
                <div key={c.id} className="flex items-start gap-2 py-1 border-b border-[var(--border-light)] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{c.title}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {c.projects?.title ?? 'Project'} · {c.flagged_at ? new Date(c.flagged_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${priced ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--warning-bg)] text-[var(--warning)]'}`}>
                    {priced ? `Priced $${c.cost_change}` : String(c.status ?? 'flagged')}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
