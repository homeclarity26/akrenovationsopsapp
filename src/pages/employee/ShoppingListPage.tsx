import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MOCK_SHOPPING_ITEMS } from '@/data/mock'
import { cn } from '@/lib/utils'

export function ShoppingListPage() {
  const [items, setItems] = useState(MOCK_SHOPPING_ITEMS)

  const toggle = (id: string) => {
    setItems(prev =>
      prev.map(i =>
        i.id === id ? { ...i, status: i.status === 'needed' ? 'purchased' as const : 'needed' as const } : i
      )
    )
  }

  const needed = items.filter(i => i.status === 'needed')
  const purchased = items.filter(i => i.status === 'purchased')

  const grouped = needed.reduce((acc, item) => {
    if (!acc[item.project_title]) acc[item.project_title] = []
    acc[item.project_title].push(item)
    return acc
  }, {} as Record<string, typeof items>)

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-display text-2xl text-[var(--navy)]">Shopping List</h1>
        <button className="flex items-center gap-1.5 bg-[var(--navy)] text-white px-3 py-2 rounded-lg text-sm font-medium">
          <Plus size={15} />
          Add Item
        </button>
      </div>

      {Object.entries(grouped).map(([project, projectItems]) => (
        <div key={project}>
          <SectionHeader title={project} />
          <Card padding="none">
            {projectItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0"
              >
                <button
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    item.status === 'purchased'
                      ? 'bg-[var(--success)] border-[var(--success)]'
                      : 'border-[var(--border)] hover:border-[var(--navy)]'
                  )}
                >
                  {item.status === 'purchased' && <Check size={13} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', item.status === 'purchased' && 'line-through text-[var(--text-tertiary)]')}>
                    {item.item_name}
                  </p>
                  {item.unit && (
                    <p className="text-xs text-[var(--text-tertiary)]">{item.quantity} {item.unit}</p>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}

      {purchased.length > 0 && (
        <div>
          <SectionHeader title={`Purchased (${purchased.length})`} />
          <Card padding="none">
            {purchased.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
                <button
                  onClick={() => toggle(item.id)}
                  className="w-6 h-6 rounded-full bg-[var(--success)] border-2 border-[var(--success)] flex items-center justify-center flex-shrink-0"
                >
                  <Check size={13} className="text-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through text-[var(--text-tertiary)]">{item.item_name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{item.project_title}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
