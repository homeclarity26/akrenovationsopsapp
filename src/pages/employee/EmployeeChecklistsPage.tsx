import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle, ExternalLink, X, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < today()
}

interface ChecklistItem {
  id: string
  instance_id: string
  item_text: string
  is_completed: boolean
  completed_at: string | null
  status: string
  title?: string
  description?: string | null
  due_date?: string | null
  external_link?: string | null
  instance_title?: string
}

export function EmployeeChecklistsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: rawItems = [], isLoading, error, refetch } = useQuery({
    queryKey: ['checklist-instance-items', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('checklist_instance_items')
        .select('*, checklist_instances(title, project_id, projects(title))')
        .order('created_at', { ascending: true })
      return (data ?? []).map((i: any) => ({
        id: i.id,
        instance_id: i.instance_id,
        item_text: i.item_text,
        is_completed: i.is_completed ?? false,
        completed_at: i.completed_at ?? null,
        status: i.is_completed ? 'completed' : 'pending',
        title: i.item_text,
        description: null,
        due_date: null,
        external_link: null,
        instance_title: i.checklist_instances?.projects?.title ?? i.checklist_instances?.title ?? 'Unassigned',
      })) as ChecklistItem[]
    },
  })

  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({})
  const items: ChecklistItem[] = rawItems.map(i => ({
    ...i,
    status: localOverrides[i.id] ?? i.status,
    is_completed: (localOverrides[i.id] ?? i.status) === 'completed',
  }))

  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null)

  const grouped = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {}
    for (const item of items) {
      const label = item.instance_title ?? 'Unassigned'
      if (!map[label]) map[label] = []
      map[label].push(item)
    }
    return map
  }, [items])

  const pendingCount = items.filter((i) => i.status !== 'completed').length

  async function markComplete(id: string) {
    setLocalOverrides(prev => ({ ...prev, [id]: 'completed' }))
    await supabase.from('checklist_instance_items').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['checklist-instance-items', user?.id] })
    setActiveItem(null)
  }

  async function markBlocked(id: string) {
    setLocalOverrides(prev => ({ ...prev, [id]: 'blocked' }))
    await supabase.from('checklist_instance_items').update({ status: 'blocked', updated_at: new Date().toISOString() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['checklist-instance-items', user?.id] })
    setActiveItem(null)
  }

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load checklists. Check your connection and try again.</p>
      <button onClick={() => refetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)]">
          <ArrowLeft size={20} />
        </button>
        <PageHeader title="Checklists" subtitle={`${pendingCount} items assigned to you`} />
      </div>

      {(isLoading || Object.keys(grouped).length === 0) && (
        <Card padding="lg">
          <p className="text-sm text-[var(--text-secondary)] text-center">
            {isLoading ? 'Loading...' : 'No checklists assigned.'}
          </p>
        </Card>
      )}

      {Object.entries(grouped).map(([label, groupItems]) => (
        <div key={label} className="space-y-2">
          <h2 className="font-display text-lg text-[var(--navy)]">{label}</h2>
          <Card padding="none">
            {groupItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveItem(item)}
                className="w-full flex items-start gap-3 px-4 py-3 border-b border-[var(--border-light)] last:border-b-0 text-left hover:bg-[var(--bg)] transition-colors"
              >
                {item.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
                ) : item.status === 'blocked' ? (
                  <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-[14px] font-body',
                      item.status === 'completed'
                        ? 'text-[var(--text-tertiary)] line-through'
                        : 'text-[var(--text)]',
                    )}
                  >
                    {item.item_text}
                  </p>
                  {item.due_date && (
                    <p
                      className={cn(
                        'text-[11px] mt-0.5',
                        isOverdue(item.due_date ?? null) && item.status !== 'completed'
                          ? 'text-[var(--danger)] font-semibold'
                          : 'text-[var(--text-tertiary)]',
                      )}
                    >
                      Due {item.due_date}
                      {isOverdue(item.due_date ?? null) && item.status !== 'completed' ? ' · overdue' : ''}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </Card>
        </div>
      ))}

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0">
          <Card className="w-full rounded-b-none" padding="lg">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-display text-xl text-[var(--navy)] leading-tight">
                {activeItem.item_text}
              </h3>
              <button
                onClick={() => setActiveItem(null)}
                className="flex-shrink-0 p-1 -mt-1 -mr-1 rounded-full hover:bg-[var(--bg)]"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            {activeItem.description && (
              <p className="text-sm text-[var(--text-secondary)] mb-3">{activeItem.description}</p>
            )}
            {activeItem.due_date && (
              <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
                Due {activeItem.due_date}
              </p>
            )}
            {activeItem.external_link && (
              <a
                href={activeItem.external_link ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="w-full mb-2 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-body font-medium text-[var(--navy)]"
              >
                <ExternalLink className="w-4 h-4" />
                Open link
              </a>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => markComplete(activeItem.id)}>Mark complete</Button>
              <Button variant="secondary" onClick={() => markBlocked(activeItem.id)}>
                Blocked
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
