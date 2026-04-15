import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface CategoryRow {
  id: string
  name: string
  sort_order: number
  icon: string | null
}

export function InventoryCategoryList() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const companyId = user?.company_id ?? undefined

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')

  const { data: categories = [], error } = useQuery<CategoryRow[]>({
    queryKey: ['inventory_categories', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('id, name, sort_order, icon')
        .eq('company_id', companyId)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as CategoryRow[]
    },
  })

  const { data: itemCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['inventory_category_item_counts', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('category_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as Array<{ category_id: string | null }>) {
        if (row.category_id) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1
      }
      return counts
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Company not loaded')
      if (!newName.trim()) throw new Error('Name required')
      const nextSort = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 10 : 10
      const { error } = await supabase
        .from('inventory_categories')
        .insert({
          company_id: companyId,
          name: newName.trim(),
          icon: newIcon.trim() || null,
          sort_order: nextSort,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_categories'] })
      setAdding(false)
      setNewName('')
      setNewIcon('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, icon }: { id: string; name: string; icon: string | null }) => {
      const { error } = await supabase
        .from('inventory_categories')
        .update({ name: name.trim(), icon: icon?.trim() || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_categories'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const count = itemCounts[id] ?? 0
      if (count > 0) throw new Error(`${count} item${count === 1 ? '' : 's'} still use this category — move them first.`)
      const { error } = await supabase
        .from('inventory_categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_categories'] })
    },
    onError: (err: Error) => {
      alert(err.message)
    },
  })

  const moveMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order)
      const idx = sorted.findIndex(c => c.id === id)
      if (idx === -1) return
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return
      const a = sorted[idx]
      const b = sorted[swapIdx]
      // Swap sort_order values in two separate updates.
      const { error: e1 } = await supabase
        .from('inventory_categories')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('inventory_categories')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id)
      if (e2) throw e2
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_categories'] })
    },
  })

  const startEdit = (c: CategoryRow) => {
    setEditingId(c.id)
    setEditName(c.name)
    setEditIcon(c.icon ?? '')
  }

  if (error) {
    return <Card><p className="text-sm text-[var(--danger)]">Could not load categories.</p></Card>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          Categories are used to group items. Reorder with the arrows.
        </p>
        <Button size="sm" onClick={() => setAdding(v => !v)}>
          <Plus size={13} />
          {adding ? 'Cancel' : 'Add category'}
        </Button>
      </div>

      {adding && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <input
              autoFocus
              placeholder="Name"
              className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)]"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMutation.mutate() }}
            />
            <input
              placeholder="Icon (e.g. wrench)"
              className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)]"
              value={newIcon}
              onChange={e => setNewIcon(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMutation.mutate() }}
            />
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newName.trim()}>
              {addMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Card>
      )}

      {categories.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">
            No categories yet. Add one to start grouping items.
          </p>
        </Card>
      ) : (
        <Card padding="none">
          {categories.map((c, i) => {
            const count = itemCounts[c.id] ?? 0
            const isEditing = editingId === c.id
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 p-3 border-b border-[var(--border-light)] last:border-0"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => moveMutation.mutate({ id: c.id, direction: 'up' })}
                    disabled={i === 0 || moveMutation.isPending}
                    className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--navy)] disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveMutation.mutate({ id: c.id, direction: 'down' })}
                    disabled={i === categories.length - 1 || moveMutation.isPending}
                    className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--navy)] disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {isEditing ? (
                  <>
                    <input
                      className="flex-1 px-2 py-1.5 rounded-lg border border-[var(--border)] text-sm bg-[var(--bg)]"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                    <input
                      placeholder="icon"
                      className="w-32 px-2 py-1.5 rounded-lg border border-[var(--border)] text-sm bg-[var(--bg)]"
                      value={editIcon}
                      onChange={e => setEditIcon(e.target.value)}
                    />
                    <button
                      onClick={() => updateMutation.mutate({ id: c.id, name: editName, icon: editIcon })}
                      disabled={updateMutation.isPending || !editName.trim()}
                      className="p-1.5 rounded-lg text-[var(--success)] hover:bg-[var(--success-bg)]"
                      aria-label="Save"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:bg-gray-100"
                      aria-label="Cancel"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">{c.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {count} item{count === 1 ? '' : 's'}
                        {c.icon ? ` · icon: ${c.icon}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => startEdit(c)}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-gray-100"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete category "${c.name}"?`)) deleteMutation.mutate(c.id)
                      }}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                      aria-label={`Delete ${c.name}`}
                      title={count > 0 ? `${count} items use this category` : 'Delete'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
