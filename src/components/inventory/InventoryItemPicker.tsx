// InventoryItemPicker
// -----------------------------------------------------------------------------
// Small modal for picking an inventory_items row to link to something (PR 10
// uses it for shopping_list_items; future PRs may reuse). Search input +
// category-grouped list. Active items only.
//
// Heads-up: PR 8 is building the admin inventory UI in parallel and may also
// create files in src/components/inventory/. If there's a duplicate picker
// component at merge time, dedupe and keep the richer implementation.

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export interface InventoryItemPickerResult {
  id: string
  name: string
}

interface InventoryItemPickerProps {
  companyId: string | null | undefined
  open: boolean
  onClose: () => void
  onPick: (item: InventoryItemPickerResult) => void
}

interface CatalogItem {
  id: string
  name: string
  unit: string | null
  category_id: string | null
  is_active: boolean
  inventory_categories: { id: string; name: string; sort_order: number } | null
}

export function InventoryItemPicker({ companyId, open, onClose, onPick }: InventoryItemPickerProps) {
  const [query, setQuery] = useState('')

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['inventory-picker-items', companyId],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, unit, category_id, is_active, inventory_categories(id, name, sort_order)')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .order('name')
      return (data ?? []) as unknown as CatalogItem[]
    },
  })

  // Group by category (name + sort_order). Unassigned → bottom bucket.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? items.filter((i) => i.name.toLowerCase().includes(q))
      : items

    const buckets = new Map<
      string,
      { name: string; sort: number; items: CatalogItem[] }
    >()
    for (const item of filtered) {
      const cat = item.inventory_categories
      const key = cat?.id ?? '__uncat__'
      if (!buckets.has(key)) {
        buckets.set(key, {
          name: cat?.name ?? 'Uncategorized',
          sort: cat?.sort_order ?? 9999,
          items: [],
        })
      }
      buckets.get(key)!.items.push(item)
    }
    return [...buckets.values()].sort((a, b) => a.sort - b.sort)
  }, [items, query])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <h2 className="font-display text-base text-[var(--navy)]">Link to inventory</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--border-light)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[var(--border-light)]">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full border-[1.5px] border-[var(--border)] rounded-[12px] bg-[var(--bg)] pl-9 pr-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {!companyId && (
            <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              No company context — cannot load inventory.
            </p>
          )}
          {companyId && isLoading && (
            <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading inventory...</p>
          )}
          {companyId && error && (
            <p className="p-6 text-center text-sm text-[var(--danger)]">Failed to load inventory.</p>
          )}
          {companyId && !isLoading && !error && items.length === 0 && (
            <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              No inventory items yet. An admin can add them from the Inventory page.
            </p>
          )}
          {companyId && !isLoading && !error && items.length > 0 && grouped.length === 0 && (
            <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">
              No items match "{query}".
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.name}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] px-4 pt-3 pb-1">
                {group.name}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPick({ id: item.id, name: item.name })
                    onClose()
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 border-b border-[var(--border-light)] last:border-0',
                    'hover:bg-[var(--border-light)] transition-colors',
                  )}
                >
                  <p className="text-sm font-medium text-[var(--text)]">{item.name}</p>
                  {item.unit && (
                    <p className="text-xs text-[var(--text-tertiary)]">per {item.unit}</p>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
