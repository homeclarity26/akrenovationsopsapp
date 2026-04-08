import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Clock, AlertTriangle, Sparkles, ExternalLink, X } from 'lucide-react'
import { Card, MetricCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import { EditableDeliverable } from '@/components/ui/EditableDeliverable'
import type { EditableItem } from '@/components/ui/EditableDeliverable'
import {
  MOCK_CHECKLIST_INSTANCES,
  MOCK_CHECKLIST_INSTANCE_ITEMS,
  MOCK_CHECKLIST_TEMPLATES,
} from '@/data/mock'
import type {
  ChecklistInstance,
  ChecklistInstanceItem,
  ChecklistItemStatus,
} from '@/data/mock'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'due_today' | 'overdue' | 'my_items'

const STATUS_CFG: Record<ChecklistItemStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-gray-100 text-[var(--text-tertiary)]' },
  in_progress: { label: 'In progress', cls: 'bg-blue-50 text-blue-600' },
  completed: { label: 'Done', cls: 'bg-[var(--success-bg)] text-[var(--success)]' },
  skipped: { label: 'Skipped', cls: 'bg-gray-100 text-[var(--text-tertiary)]' },
  blocked: { label: 'Blocked', cls: 'bg-[var(--danger-bg)] text-[var(--danger)]' },
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < today()
}

export function ChecklistsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ChecklistInstanceItem[]>(MOCK_CHECKLIST_INSTANCE_ITEMS)
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(
    MOCK_CHECKLIST_INSTANCES[0]?.id ?? null,
  )
  const [activeItem, setActiveItem] = useState<ChecklistInstanceItem | null>(null)

  const instances = MOCK_CHECKLIST_INSTANCES.filter((i) => i.status === 'active')

  const metrics = useMemo(() => {
    const todayStr = today()
    const activeInstances = instances.length
    const dueToday = items.filter((i) => i.due_date === todayStr && i.status !== 'completed').length
    const overdue = items.filter((i) => isOverdue(i.due_date) && i.status !== 'completed').length
    const completedThisWeek = items.filter(
      (i) => i.status === 'completed',
    ).length
    return { activeInstances, dueToday, overdue, completedThisWeek }
  }, [items, instances])

  function itemsForInstance(instanceId: string): ChecklistInstanceItem[] {
    let list = items.filter((i) => i.instance_id === instanceId)
    if (filter === 'due_today') {
      list = list.filter((i) => i.due_date === today() && i.status !== 'completed')
    } else if (filter === 'overdue') {
      list = list.filter((i) => isOverdue(i.due_date) && i.status !== 'completed')
    } else if (filter === 'my_items') {
      list = list.filter((i) => i.assigned_to === 'admin-1')
    }
    return list.sort((a, b) => a.sort_order - b.sort_order)
  }

  function completionForInstance(inst: ChecklistInstance): { done: number; total: number; pct: number } {
    const allForInstance = items.filter((i) => i.instance_id === inst.id)
    const done = allForInstance.filter((i) => i.status === 'completed').length
    const total = allForInstance.length || inst.completion_percent || 1
    const pct = total === 0 ? inst.completion_percent : Math.round((done / total) * 100)
    return { done, total, pct }
  }

  function markComplete(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'completed' } : i)),
    )
    setActiveItem(null)
  }

  function markBlocked(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'blocked' } : i)))
    setActiveItem(null)
  }

  function markSkipped(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'skipped' } : i)))
    setActiveItem(null)
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Checklists"
        subtitle="Every workflow, every SOP, every follow-up — tracked here."
        action={
          <Button variant="secondary" onClick={() => navigate('/admin/settings/checklists')}>
            Templates
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active" value={metrics.activeInstances} subtitle="Checklists" />
        <MetricCard label="Due today" value={metrics.dueToday} />
        <MetricCard label="Overdue" value={metrics.overdue} />
        <MetricCard label="Done this week" value={metrics.completedThisWeek} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'due_today', 'overdue', 'my_items'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-body font-medium whitespace-nowrap border transition-colors',
              filter === f
                ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                : 'bg-white text-[var(--text-secondary)] border-[var(--border)]',
            )}
          >
            {f === 'all' && 'All'}
            {f === 'due_today' && 'Due today'}
            {f === 'overdue' && 'Overdue'}
            {f === 'my_items' && 'My items'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <SectionHeader title="Active Checklists" />
        {instances.map((inst) => {
          const { done, total, pct } = completionForInstance(inst)
          const expanded = expandedInstanceId === inst.id
          const visibleItems = itemsForInstance(inst.id)
          const nextDue = visibleItems.find((i) => i.status !== 'completed')
          return (
            <Card key={inst.id} padding="none" className="overflow-hidden">
              <button
                onClick={() => setExpandedInstanceId(expanded ? null : inst.id)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-semibold text-[15px] text-[var(--navy)] truncate">
                      {inst.template_name}
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)] truncate">
                      {inst.entity_label}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-[13px] text-[var(--text)] font-semibold">
                      {done}/{total || '-'}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                      {pct}%
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--border-light)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--rust)] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {nextDue && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                    <Clock className="w-3 h-3" />
                    <span>Next: {nextDue.title}</span>
                    {isOverdue(nextDue.due_date) && (
                      <span className="text-[var(--danger)] font-semibold">· overdue</span>
                    )}
                  </div>
                )}
              </button>

              {expanded && (
                <div className="border-t border-[var(--border-light)] bg-[var(--bg)]">
                  {visibleItems.length === 0 && (
                    <p className="p-4 text-sm text-[var(--text-tertiary)]">No items match this filter.</p>
                  )}
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveItem(item)}
                      className="w-full flex items-start gap-3 px-4 py-3 border-b border-[var(--border-light)] last:border-b-0 text-left hover:bg-white transition-colors"
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
                          {item.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                          <span className="uppercase tracking-wider">{item.assigned_role}</span>
                          {item.due_date && <span>Due {item.due_date}</span>}
                          {item.ai_help_available && (
                            <span className="flex items-center gap-0.5 text-[var(--rust)]">
                              <Sparkles className="w-3 h-3" />
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-body font-medium uppercase tracking-wider',
                          STATUS_CFG[item.status].cls,
                        )}
                      >
                        {STATUS_CFG[item.status].label}
                      </span>
                    </button>
                  ))}

                  {/* Template source info + editable items */}
                  <div className="px-4 py-4 border-t border-[var(--border-light)]">
                    {inst.template_id && (
                      <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                        Template source: {inst.template_name}
                      </p>
                    )}
                    <EditableDeliverable
                      deliverableType="checklist"
                      instanceId={inst.id}
                      instanceTable="checklist_instances"
                      templateId={inst.template_id}
                      templateName={inst.template_name}
                      items={itemsForInstance(inst.id).map((i): EditableItem => ({
                        id: i.id,
                        title: i.title,
                        description: i.description ?? undefined,
                      }))}
                      onSave={async (editedItems) => {
                        setItems((prev) => {
                          const otherItems = prev.filter((i) => i.instance_id !== inst.id)
                          const updatedItems = editedItems.map((ei, idx) => {
                            const existing = prev.find((pi) => pi.id === ei.id)
                            return existing
                              ? { ...existing, title: ei.title, description: ei.description ?? null }
                              : {
                                  id: ei.id,
                                  instance_id: inst.id,
                                  title: ei.title,
                                  description: ei.description ?? null,
                                  sort_order: idx,
                                  status: 'pending' as ChecklistItemStatus,
                                  assigned_role: 'admin',
                                  due_date: null,
                                  ai_help_available: false,
                                  external_link: null,
                                  assigned_to: null,
                                }
                          })
                          return [...otherItems, ...updatedItems]
                        })
                      }}
                      isEditable={true}
                      showPromoteOption={true}
                    />
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4">
          <Card className="w-full max-w-lg rounded-b-none sm:rounded-xl" padding="lg">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-display text-xl text-[var(--navy)] leading-tight">
                {activeItem.title}
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

            <div className="flex items-center gap-2 mb-4 text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">
              <span>{activeItem.assigned_role}</span>
              {activeItem.due_date && <span>· Due {activeItem.due_date}</span>}
            </div>

            {activeItem.ai_help_available && (
              <button
                className="w-full mb-2 flex items-center justify-center gap-2 rounded-xl border border-[var(--navy)] bg-[var(--navy)] text-white px-4 py-3 text-sm font-body font-medium"
                onClick={() => {
                  navigate('/admin/ai')
                }}
              >
                <Sparkles className="w-4 h-4" />
                Get AI help
              </button>
            )}

            {activeItem.external_link && (
              <a
                href={activeItem.external_link}
                target="_blank"
                rel="noreferrer"
                className="w-full mb-2 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-body font-medium text-[var(--navy)]"
              >
                <ExternalLink className="w-4 h-4" />
                Open link
              </a>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => markComplete(activeItem.id)}>Complete</Button>
              <Button variant="secondary" onClick={() => markSkipped(activeItem.id)}>
                Skip
              </Button>
              <Button variant="secondary" onClick={() => markBlocked(activeItem.id)}>
                Blocked
              </Button>
            </div>
          </Card>
        </div>
      )}

      <p className="text-[11px] text-[var(--text-tertiary)] text-center pt-4">
        {MOCK_CHECKLIST_TEMPLATES.length} master templates loaded
      </p>
    </div>
  )
}
