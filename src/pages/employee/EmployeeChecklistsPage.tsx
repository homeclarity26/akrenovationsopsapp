import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle, ExternalLink, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MOCK_CHECKLIST_INSTANCE_ITEMS, MOCK_CHECKLIST_INSTANCES } from '@/data/mock'
import type { ChecklistInstanceItem } from '@/data/mock'
import { cn } from '@/lib/utils'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < today()
}

// Jeff is employee-1 in mock data
const CURRENT_EMPLOYEE_ID = 'employee-1'

export function EmployeeChecklistsPage() {
  const [items, setItems] = useState<ChecklistInstanceItem[]>(
    MOCK_CHECKLIST_INSTANCE_ITEMS.filter(
      (i) =>
        i.assigned_to === CURRENT_EMPLOYEE_ID ||
        (i.assigned_role === 'employee' && !i.assigned_to) ||
        i.assigned_role === 'any',
    ),
  )
  const [activeItem, setActiveItem] = useState<ChecklistInstanceItem | null>(null)

  const grouped = useMemo(() => {
    const map: Record<string, ChecklistInstanceItem[]> = {}
    for (const item of items) {
      const inst = MOCK_CHECKLIST_INSTANCES.find((i) => i.id === item.instance_id)
      const label = inst?.entity_label ?? 'Unassigned'
      if (!map[label]) map[label] = []
      map[label].push(item)
    }
    // sort each group by due date ascending
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    }
    return map
  }, [items])

  const pendingCount = items.filter((i) => i.status !== 'completed').length

  function markComplete(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'completed' } : i)))
    setActiveItem(null)
  }

  function markBlocked(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'blocked' } : i)))
    setActiveItem(null)
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title="Checklists" subtitle={`${pendingCount} items assigned to you`} />

      {Object.keys(grouped).length === 0 && (
        <Card padding="lg">
          <p className="text-sm text-[var(--text-secondary)] text-center">
            No checklist items assigned to you right now.
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
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                      {item.description}
                    </p>
                  )}
                  {item.due_date && (
                    <p
                      className={cn(
                        'text-[11px] mt-0.5',
                        isOverdue(item.due_date) && item.status !== 'completed'
                          ? 'text-[var(--danger)] font-semibold'
                          : 'text-[var(--text-tertiary)]',
                      )}
                    >
                      Due {item.due_date}
                      {isOverdue(item.due_date) && item.status !== 'completed' ? ' · overdue' : ''}
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
            {activeItem.due_date && (
              <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
                Due {activeItem.due_date}
              </p>
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
