import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Search, X, Package } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { LocationTypePill, type LocationType } from './LocationTypePill'

interface LocationRow {
  id: string
  name: string
  type: LocationType
  is_active: boolean
}

interface CategoryRow {
  id: string
  name: string
  sort_order: number
}

interface ItemRow {
  id: string
  name: string
  unit: string
  category_id: string | null
  min_stock_alert: number | null
  is_active: boolean
}

interface StockRow {
  id: string
  location_id: string
  item_id: string
  quantity: number
  last_counted_at: string | null
}

// For ordering: shops first, then trucks, then trailers, then jobsite, then other.
const LOCATION_TYPE_ORDER: Record<LocationType, number> = {
  shop: 0,
  truck: 1,
  trailer: 2,
  jobsite: 3,
  other: 4,
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

type SortMode = 'name' | 'low_stock'

interface InventoryStockMatrixProps {
  /**
   * When provided, the matrix is filtered down to the single item with this
   * id (e.g. after clicking an alert on the Alerts tab). The caller also
   * gets a chance to clear the filter through the search input or the
   * onClearItemFilter callback.
   */
  initialItemId?: string
  /**
   * Called when the user clears the item-id filter via the in-UI
   * "Show all items" button. Lets the parent reset its own stockFilter.itemId.
   */
  onClearItemFilter?: () => void
}

export function InventoryStockMatrix({
  initialItemId,
  onClearItemFilter,
}: InventoryStockMatrixProps = {}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const companyId = user?.company_id ?? undefined

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [editingKey, setEditingKey] = useState<string | null>(null) // `${itemId}:${locationId}`
  const [editValue, setEditValue] = useState<string>('')
  const [editError, setEditError] = useState<string | null>(null)
  // Baseline value at the moment the editor opened — used to decide whether an
  // onBlur is meaningful (mobile commit) or just a focus shift between
  // sub-elements.
  const editBaselineRef = useRef<string>('')
  // Debounce timer for keystrokes — cleared on every onChange. The mobile
  // onBlur path checks this to avoid firing a mutation per keystroke when the
  // virtual keyboard shifts focus between presses.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks the timestamp of the last keystroke so onBlur can gate on "at least
  // 300ms since the last keystroke" before committing.
  const lastKeystrokeRef = useRef<number>(0)
  // When AdminInventoryPage passes `initialItemId`, this ref points at the row
  // so useEffect can scrollIntoView on mount.
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null)

  const { data: locations = [] } = useQuery<LocationRow[]>({
    queryKey: ['inventory_locations', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name, type, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as LocationRow[]
    },
  })

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ['inventory_categories', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('id, name, sort_order')
        .eq('company_id', companyId)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as CategoryRow[]
    },
  })

  const { data: items = [] } = useQuery<ItemRow[]>({
    queryKey: ['inventory_items', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, unit, category_id, min_stock_alert, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as ItemRow[]
    },
  })

  // When the caller hands us an initialItemId (e.g. from the Alerts tab),
  // pre-populate the search input with the item's name as soon as the items
  // query resolves. We don't lock the input — clearing it drops the filter.
  useEffect(() => {
    if (!initialItemId) return
    const match = items.find(i => i.id === initialItemId)
    if (!match) return
    setSearch(prev => (prev.length === 0 ? match.name : prev))
    // Clear any unrelated category filter so the item isn't filtered out.
    setCategoryFilter('')
    // Scroll the single-item row into view on the next paint.
    requestAnimationFrame(() => {
      highlightRowRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [initialItemId, items])

  const { data: stock = [] } = useQuery<StockRow[]>({
    queryKey: ['inventory_stock', companyId],
    enabled: !!companyId && locations.length > 0,
    queryFn: async () => {
      const locationIds = locations.map(l => l.id)
      const { data, error } = await supabase
        .from('inventory_stock')
        .select('id, location_id, item_id, quantity, last_counted_at')
        .in('location_id', locationIds)
      if (error) throw error
      return ((data ?? []) as StockRow[]).map(r => ({ ...r, quantity: Number(r.quantity) }))
    },
  })

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      const ta = LOCATION_TYPE_ORDER[a.type] ?? 99
      const tb = LOCATION_TYPE_ORDER[b.type] ?? 99
      if (ta !== tb) return ta - tb
      return a.name.localeCompare(b.name)
    })
  }, [locations])

  const categoryById = useMemo(() => {
    const m = new Map<string, CategoryRow>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  // Build lookup: itemId → locationId → quantity.
  const stockByItemLoc = useMemo(() => {
    const m = new Map<string, Map<string, StockRow>>()
    for (const s of stock) {
      if (!m.has(s.item_id)) m.set(s.item_id, new Map())
      m.get(s.item_id)!.set(s.location_id, s)
    }
    return m
  }, [stock])

  // Item totals across all locations.
  const totalsByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stock) {
      m.set(s.item_id, (m.get(s.item_id) ?? 0) + Number(s.quantity))
    }
    return m
  }, [stock])

  // Filter + sort items.
  const displayedItems = useMemo(() => {
    let list = items
    // Hard filter when the caller asked us to focus on a single item.
    if (initialItemId) {
      list = list.filter(i => i.id === initialItemId)
    }
    if (categoryFilter) {
      list = list.filter(i => i.category_id === categoryFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(i => i.name.toLowerCase().includes(q))
    }
    const withMeta = list.map(i => ({
      item: i,
      total: totalsByItem.get(i.id) ?? 0,
      category: i.category_id ? categoryById.get(i.category_id) : null,
    }))
    if (sortMode === 'low_stock') {
      withMeta.sort((a, b) => a.total - b.total || a.item.name.localeCompare(b.item.name))
    } else {
      withMeta.sort((a, b) => {
        const ca = a.category?.sort_order ?? 1_000_000
        const cb = b.category?.sort_order ?? 1_000_000
        if (ca !== cb) return ca - cb
        return a.item.name.localeCompare(b.item.name)
      })
    }
    return withMeta
  }, [items, initialItemId, categoryFilter, search, sortMode, totalsByItem, categoryById])

  const upsertMutation = useMutation({
    mutationFn: async ({ itemId, locationId, quantity }: { itemId: string; locationId: string; quantity: number }) => {
      if (!user?.id) throw new Error('Not authenticated')
      const { error } = await supabase.from('inventory_stocktakes').insert({
        item_id: itemId,
        location_id: locationId,
        counted_by: user.id,
        quantity_after: quantity,
        confidence: 'exact',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_stock'] })
      queryClient.invalidateQueries({ queryKey: ['inventory_stocktakes'] })
      setEditingKey(null)
      setEditValue('')
      setEditError(null)
    },
    onError: (err: Error) => setEditError(err.message),
  })

  const openEditor = (itemId: string, locationId: string, currentQty: number) => {
    const baseline = String(currentQty ?? 0)
    setEditingKey(`${itemId}:${locationId}`)
    setEditValue(baseline)
    setEditError(null)
    editBaselineRef.current = baseline
    lastKeystrokeRef.current = 0
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  // Pure keystroke handler — update local state only, never mutate. This is
  // Fix 2: we do NOT write to Supabase until the user explicitly confirms
  // (Enter, the Check button, or a gated blur on mobile).
  const onEditValueChange = (next: string) => {
    setEditValue(next)
    lastKeystrokeRef.current = Date.now()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // No auto-commit — the debounce just resets on each keystroke. We only
    // use it to gate the onBlur commit path on mobile (see handleBlurCommit).
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
    }, 300)
  }

  const commitEditor = (itemId: string, locationId: string) => {
    const n = Number(editValue)
    if (!Number.isFinite(n) || n < 0) {
      setEditError('Enter a non-negative number')
      return
    }
    // Skip the mutation entirely if the value didn't change from baseline —
    // no reason to create a stocktake row for a no-op.
    if (editValue === editBaselineRef.current) {
      setEditingKey(null)
      setEditError(null)
      return
    }
    upsertMutation.mutate({ itemId, locationId, quantity: n })
  }

  // Mobile onBlur path: only commit if
  //   (a) the value actually changed from baseline, AND
  //   (b) at least 300ms has passed since the last keystroke.
  // Guards against virtual-keyboard focus churn firing a mutation per press.
  const handleBlurCommit = (itemId: string, locationId: string) => {
    if (editValue === editBaselineRef.current) {
      // No change — just close the editor, no mutation.
      setEditingKey(null)
      setEditError(null)
      return
    }
    const since = Date.now() - lastKeystrokeRef.current
    if (since < 300) return // still mid-typing, ignore this blur
    commitEditor(itemId, locationId)
  }

  if (locations.length === 0 && items.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Package size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
        <p className="font-medium text-sm text-[var(--text)]">No stock data yet</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto">Add your first items and locations to start tracking inventory across your trucks, shop, and job sites.</p>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Package size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
        <p className="font-medium text-sm text-[var(--text)]">No active locations</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto">Add locations first so you can track stock against them.</p>
      </div>
    )
  }

  const focusedItemName = initialItemId
    ? items.find(i => i.id === initialItemId)?.name ?? null
    : null

  return (
    <div className="space-y-3">
      {/* Item-focus banner — shown when the caller handed us an initialItemId
          (e.g. after clicking an alert). One-click escape hatch. */}
      {initialItemId && focusedItemName && onClearItemFilter && (
        <div className="flex items-center justify-between gap-2 bg-[var(--navy)]/5 border border-[var(--navy)]/20 rounded-xl px-3 py-2">
          <p className="text-xs text-[var(--navy)]">
            Filtered to <span className="font-semibold">{focusedItemName}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              onClearItemFilter()
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--navy)] hover:underline"
          >
            <X size={11} /> Show all items
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value as SortMode)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--navy)]"
        >
          <option value="name">Sort: Name / Category</option>
          <option value="low_stock">Sort: Low stock first</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-[var(--border-light)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] border-b border-[var(--border-light)]">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)] sticky left-0 bg-[var(--bg)] z-10 min-w-[220px]">Item</th>
              {sortedLocations.map(l => (
                <th key={l.id} className="px-2 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)] min-w-[110px] whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[var(--text)]">{l.name}</span>
                    <LocationTypePill type={l.type} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)] min-w-[80px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {displayedItems.length === 0 ? (
              <tr>
                <td colSpan={sortedLocations.length + 2} className="text-center py-8 text-[var(--text-secondary)]">
                  No items match your filters.
                </td>
              </tr>
            ) : (
              displayedItems.map(({ item, total, category }) => {
                const isLow = item.min_stock_alert !== null && total < Number(item.min_stock_alert)
                const isFocused = initialItemId === item.id
                return (
                  <tr
                    key={item.id}
                    ref={isFocused ? highlightRowRef : undefined}
                    className={cn(
                      'border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)]',
                      isFocused && 'bg-[var(--navy)]/5',
                    )}
                  >
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-[var(--border-light)]">
                      <div className="flex items-center gap-2">
                        {isLow && (
                          <AlertCircle size={13} className="text-[var(--warning)] flex-shrink-0" aria-label="Below min alert" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--text)] truncate">{item.name}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                            {category?.name ?? 'Uncategorized'} · {item.unit}
                          </p>
                        </div>
                      </div>
                    </td>
                    {sortedLocations.map(l => {
                      const row = stockByItemLoc.get(item.id)?.get(l.id)
                      const qty = row ? Number(row.quantity) : 0
                      const key = `${item.id}:${l.id}`
                      const isEditing = editingKey === key
                      return (
                        <td key={l.id} className="px-2 py-2 text-center">
                          {isEditing ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  step="any"
                                  autoFocus
                                  value={editValue}
                                  onChange={e => onEditValueChange(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') commitEditor(item.id, l.id)
                                    if (e.key === 'Escape') { setEditingKey(null); setEditError(null) }
                                  }}
                                  className="w-16 px-1.5 py-1 rounded border border-[var(--navy)] text-center text-sm"
                                />
                                <button
                                  onClick={() => commitEditor(item.id, l.id)}
                                  disabled={upsertMutation.isPending}
                                  className="p-1 rounded text-[var(--success)] hover:bg-[var(--success-bg)]"
                                  aria-label="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => { setEditingKey(null); setEditError(null) }}
                                  className="p-1 rounded text-[var(--text-tertiary)] hover:bg-gray-100"
                                  aria-label="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <span className="text-[9px] text-[var(--text-tertiary)] leading-none">
                                Press Enter to save
                              </span>
                              {editError && (
                                <span className="text-[10px] text-[var(--danger)] leading-none">
                                  {editError}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => openEditor(item.id, l.id, qty)}
                              className={cn(
                                'w-full px-2 py-1 rounded font-mono text-sm transition-colors',
                                qty === 0 ? 'text-[var(--text-tertiary)]' : 'text-[var(--text)]',
                                'hover:bg-[var(--bg)]',
                              )}
                              title={row?.last_counted_at ? `Last counted ${formatRelative(row.last_counted_at)}` : 'No count yet — click to set'}
                            >
                              {qty}
                              {row?.last_counted_at && (
                                <span className="block text-[9px] text-[var(--text-tertiary)] font-normal">
                                  {formatRelative(row.last_counted_at)}
                                </span>
                              )}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className={cn(
                      'px-3 py-2 text-right font-mono font-semibold',
                      isLow ? 'text-[var(--warning)]' : 'text-[var(--text)]',
                    )}>
                      {total}
                      {item.min_stock_alert !== null && (
                        <span className="block text-[9px] text-[var(--text-tertiary)] font-normal">
                          min {Number(item.min_stock_alert)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editError && (
        <p className="text-xs text-[var(--danger)] text-center">{editError}</p>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {displayedItems.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No items match your filters.</p>
          </Card>
        ) : (
          displayedItems.map(({ item, total, category }) => {
            const isLow = item.min_stock_alert !== null && total < Number(item.min_stock_alert)
            return (
              <Card key={item.id} padding="sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isLow && <AlertCircle size={13} className="text-[var(--warning)]" />}
                      <p className="font-semibold text-[var(--text)] truncate">{item.name}</p>
                    </div>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {category?.name ?? 'Uncategorized'} · {item.unit}
                    </p>
                  </div>
                  <div className={cn(
                    'font-mono font-semibold text-lg',
                    isLow ? 'text-[var(--warning)]' : 'text-[var(--text)]',
                  )}>
                    {total}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {sortedLocations.map(l => {
                    const row = stockByItemLoc.get(item.id)?.get(l.id)
                    const qty = row ? Number(row.quantity) : 0
                    const key = `${item.id}:${l.id}`
                    const isEditing = editingKey === key
                    return (
                      <div key={l.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-1 rounded-lg border border-[var(--border-light)] px-2 py-1">
                          <span className="text-[10px] text-[var(--text-tertiary)] truncate">{l.name}</span>
                          {isEditing ? (
                            <input
                              type="number"
                              step="any"
                              autoFocus
                              value={editValue}
                              onChange={e => onEditValueChange(e.target.value)}
                              onBlur={() => handleBlurCommit(item.id, l.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEditor(item.id, l.id)
                                if (e.key === 'Escape') { setEditingKey(null); setEditError(null) }
                              }}
                              className="w-16 px-1.5 py-0.5 rounded border border-[var(--navy)] text-right text-xs font-mono"
                            />
                          ) : (
                            <button
                              onClick={() => openEditor(item.id, l.id, qty)}
                              className="font-mono text-xs text-[var(--text)]"
                            >
                              {qty}
                            </button>
                          )}
                        </div>
                        {isEditing && (
                          <>
                            <span className="text-[9px] text-[var(--text-tertiary)] leading-none px-1">
                              Press Enter to save
                            </span>
                            {editError && (
                              <span className="text-[10px] text-[var(--danger)] leading-none px-1">
                                {editError}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
