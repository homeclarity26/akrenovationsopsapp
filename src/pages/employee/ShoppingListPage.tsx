import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface ShoppingItem {
  id: string
  item_name: string
  quantity: number | null
  unit: string | null
  status: string
  project_id: string | null
  project_title?: string
}

// N40: Template generation happens when a phase starts — see agent-calibrate-templates edge function
export function ShoppingListPage() {
  const queryClient = useQueryClient()

  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['shopping-list-items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*, projects(title)')
        .order('created_at', { ascending: false })
      return (data ?? []).map((i: any) => ({
        ...i,
        project_title: i.projects?.title ?? 'No Project',
      })) as ShoppingItem[]
    },
  })

  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({})

  const items: ShoppingItem[] = rawItems.map(i => ({
    ...i,
    status: localOverrides[i.id] ?? i.status,
  }))

  const toggle = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newStatus = item.status === 'needed' ? 'purchased' : 'needed'
    setLocalOverrides(prev => ({ ...prev, [id]: newStatus }))
    await supabase.from('shopping_list_items').update({ status: newStatus }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
  }

  const needed = items.filter(i => i.status === 'needed')
  const purchased = items.filter(i => i.status !== 'needed')

  const grouped = needed.reduce((acc, item) => {
    const key = item.project_title ?? 'No Project'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, ShoppingItem[]>)

  if (isLoading) {
    return (
      <div className="p-4 pt-6">
        <h1 className="font-display text-2xl text-[var(--navy)] mb-4">Shopping List</h1>
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-display text-2xl text-[var(--navy)]">Shopping List</h1>
        <button className="flex items-center gap-1.5 bg-[var(--navy)] text-white px-3 py-2 rounded-lg text-sm font-medium">
          <Plus size={15} />
          Add Item
        </button>
      </div>

      {needed.length === 0 && purchased.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] text-center py-8">No items on the list.</p>
      )}

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
