// N38: Admin editing of punch list items happens via the Project Detail page
// punch tab (/admin/projects/:id → "Punch" tab). EditableDeliverable is wired
// there. This client portal view is intentionally read-only for item content —
// clients can only mark items complete and sign off.
import { useState } from 'react'
import { Check, Circle, PenLine } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface PunchListItem {
  id: string
  project_id: string
  description: string
  location?: string | null
  status: 'open' | 'in_progress' | 'complete'
  photo_url?: string | null
  assigned_to?: string | null
  sort_order?: number | null
}

export function ClientPunchList() {
  const { user } = useAuth()

  const { data: projectId } = useQuery({
    queryKey: ['client_project_id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('client_user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle()
      return data?.id ?? null
    },
  })

  const { data: dbItems = [], error, refetch } = useQuery({
    queryKey: ['punch_list_items', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('punch_list_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('sort_order', { ascending: true })
      return (data ?? []) as PunchListItem[]
    },
  })

  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<PunchListItem>>>({})
  const items: PunchListItem[] = dbItems.map(i => ({ ...i, ...localOverrides[i.id] }))

  const setItems = (fn: (prev: PunchListItem[]) => PunchListItem[]) => {
    const next = fn(items)
    const overrides: Record<string, Partial<PunchListItem>> = {}
    for (const item of next) overrides[item.id] = item
    setLocalOverrides(overrides)
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load punch list. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  if (dbItems.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">No punch list items yet.</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Items will appear here when your contractor adds them.</p>
      </div>
    )
  }
  const [signed, setSigned] = useState(false)

  const open = items.filter(i => i.status === 'open')
  const complete = items.filter(i => i.status === 'complete')
  const allDone = open.length === 0

  const markComplete = (id: string) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'complete' as const } : i
    ))
  }

  return (
    <div className="p-4 space-y-5">
      {/* Status bar */}
      <div className={`p-4 rounded-2xl ${allDone ? 'bg-[var(--success-bg)]' : 'bg-[var(--warning-bg)]'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${allDone ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}>
            {allDone ? <Check size={20} className="text-white" /> : <Circle size={20} className="text-white" />}
          </div>
          <div>
            <p className={`font-semibold text-sm ${allDone ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {allDone ? 'All items complete!' : `${open.length} item${open.length !== 1 ? 's' : ''} remaining`}
            </p>
            <p className={`text-xs ${allDone ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {complete.length} of {items.length} complete
            </p>
          </div>
        </div>
      </div>

      {/* Open items */}
      {open.length > 0 && (
        <Card padding="none">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Open Items</p>
          </div>
          {open.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 border-t border-[var(--border-light)]">
              <button
                onClick={() => markComplete(item.id)}
                className="w-6 h-6 rounded-full border-2 border-[var(--border)] flex items-center justify-center flex-shrink-0 hover:border-[var(--navy)] transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{item.description}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.location}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Complete items */}
      {complete.length > 0 && (
        <Card padding="none">
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Completed</p>
          </div>
          {complete.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 border-t border-[var(--border-light)]">
              <div className="w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center flex-shrink-0">
                <Check size={13} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm line-through text-[var(--text-tertiary)]">{item.description}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{item.location}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Final sign-off */}
      {allDone && !signed && (
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <PenLine size={18} className="text-[var(--navy)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text)]">Final Sign-Off</p>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                All punch list items are complete. Tap below to officially sign off on the project.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSigned(true)}
            className="w-full py-4 rounded-xl bg-[var(--navy)] text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <PenLine size={16} />
            Sign Off on Project
          </button>
        </Card>
      )}

      {signed && (
        <div className="text-center p-6">
          <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center mx-auto mb-3">
            <Check size={28} className="text-[var(--success)]" />
          </div>
          <p className="font-display text-xl text-[var(--success)]">Project Signed Off</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Thank you — we appreciate your business!</p>
        </div>
      )}
    </div>
  )
}
