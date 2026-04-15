import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Pencil, Trash2, Search, MapPin, User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { useInventoryRealtime } from '@/hooks/useInventoryRealtime'
import { InventoryStockMatrix } from '@/components/inventory/InventoryStockMatrix'
import { InventoryItemForm, type InventoryItemFormValue } from '@/components/inventory/InventoryItemForm'
import { InventoryLocationForm, type InventoryLocationFormValue } from '@/components/inventory/InventoryLocationForm'
import { InventoryCategoryList } from '@/components/inventory/InventoryCategoryList'
import { InventoryAlertsPanel } from '@/components/inventory/InventoryAlertsPanel'
import { LocationTypePill, type LocationType } from '@/components/inventory/LocationTypePill'

type Tab = 'alerts' | 'stock' | 'items' | 'locations' | 'categories'

interface ItemRow {
  id: string
  name: string
  sku: string | null
  unit: string
  pack_size: number | null
  vendor: string | null
  min_stock_alert: number | null
  target_stock_total: number | null
  notes: string | null
  is_active: boolean
  category_id: string | null
}

interface StockQtyRow {
  item_id: string
  quantity: number
}

interface LocationRow {
  id: string
  name: string
  type: LocationType
  assigned_to: string | null
  license_plate: string | null
  notes: string | null
  is_active: boolean
}

export function AdminInventoryPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const companyId = user?.company_id ?? undefined
  const [tab, setTab] = useState<Tab>('alerts')

  useInventoryRealtime()

  const { data: openAlertCount = 0 } = useQuery<number>({
    queryKey: ['inventory_alerts', companyId, 'count'],
    enabled: !!companyId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('inventory_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .eq('status', 'open')
      if (error) throw error
      return count ?? 0
    },
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'alerts',     label: openAlertCount > 0 ? `Alerts (${openAlertCount})` : 'Alerts' },
    { id: 'stock',      label: 'Stock' },
    { id: 'items',      label: 'Items' },
    { id: 'locations',  label: 'Locations' },
    { id: 'categories', label: 'Categories' },
  ]

  return (
    <div className="max-w-2xl mx-auto lg:max-w-none">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 lg:px-8 lg:py-6 border-b border-[var(--border-light)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-[var(--navy)] leading-tight flex items-center gap-2">
              <Package size={22} />
              Inventory
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
                title="This page updates live as your team submits counts"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--success)] opacity-60 animate-ping" />
                  <span className="relative rounded-full bg-[var(--success)] h-1.5 w-1.5" />
                </span>
                Live
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                Multi-location stock tracking
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border-light)] px-4 lg:px-8">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all',
              tab === t.id
                ? 'border-[var(--navy)] text-[var(--navy)]'
                : 'border-transparent text-[var(--text-tertiary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 lg:px-8 lg:py-6">
        {!companyId && (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">
              No company loaded. Inventory is scoped to your company.
            </p>
          </Card>
        )}

        {companyId && tab === 'alerts' && <InventoryAlertsPanel />}
        {companyId && tab === 'stock' && <InventoryStockMatrix />}
        {companyId && tab === 'items' && <ItemsTab companyId={companyId} queryClient={queryClient} />}
        {companyId && tab === 'locations' && <LocationsTab companyId={companyId} queryClient={queryClient} />}
        {companyId && tab === 'categories' && <InventoryCategoryList />}
      </div>
    </div>
  )
}

// ─── ITEMS TAB ──────────────────────────────────────────────────────────────

interface ItemsTabProps {
  companyId: string
  queryClient: ReturnType<typeof useQueryClient>
}

function ItemsTab({ companyId, queryClient }: ItemsTabProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItemFormValue | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory_categories', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('id, name, sort_order')
        .eq('company_id', companyId)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string; sort_order: number }>
    },
  })

  const { data: items = [] } = useQuery<ItemRow[]>({
    queryKey: ['inventory_items', companyId, showInactive],
    queryFn: async () => {
      let query = supabase
        .from('inventory_items')
        .select('id, name, sku, unit, pack_size, vendor, min_stock_alert, target_stock_total, notes, is_active, category_id')
        .eq('company_id', companyId)
        .order('name')
      if (!showInactive) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ItemRow[]
    },
  })

  const { data: stockRows = [] } = useQuery<StockQtyRow[]>({
    queryKey: ['inventory_stock', companyId],
    queryFn: async () => {
      // Need company-scoped join: select via inventory_locations.company_id.
      const { data: locData, error: locErr } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('company_id', companyId)
      if (locErr) throw locErr
      const locationIds = ((locData ?? []) as Array<{ id: string }>).map(l => l.id)
      if (locationIds.length === 0) return []
      const { data, error } = await supabase
        .from('inventory_stock')
        .select('item_id, quantity')
        .in('location_id', locationIds)
      if (error) throw error
      return ((data ?? []) as StockQtyRow[]).map(s => ({ ...s, quantity: Number(s.quantity) }))
    },
  })

  const totalsByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stockRows) m.set(s.item_id, (m.get(s.item_id) ?? 0) + Number(s.quantity))
    return m
  }, [stockRows])

  const categoryById = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const displayed = useMemo(() => {
    let list = items
    if (categoryFilter) list = list.filter(i => i.category_id === categoryFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(i => i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q))
    }
    return list
  }, [items, categoryFilter, search])

  const deactivateMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_active: active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory_stock'] })
    },
  })

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (row: ItemRow) => {
    setEditing({
      id: row.id,
      name: row.name,
      sku: row.sku,
      category_id: row.category_id,
      unit: row.unit,
      pack_size: row.pack_size,
      vendor: row.vendor,
      target_stock_total: row.target_stock_total,
      min_stock_alert: row.min_stock_alert,
      notes: row.notes,
      is_active: row.is_active,
    })
    setFormOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU"
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
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <Button size="sm" onClick={openNew}>
          <Plus size={13} />
          Add item
        </Button>
      </div>

      {formOpen && (
        <InventoryItemForm
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      )}

      <div className="hidden md:block bg-white rounded-xl border border-[var(--border-light)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] border-b border-[var(--border-light)]">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Category</th>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Unit</th>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Pack</th>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Vendor</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Min alert</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Total</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-[var(--text-secondary)]">No items match.</td></tr>
            ) : displayed.map(i => {
              const total = totalsByItem.get(i.id) ?? 0
              const category = i.category_id ? categoryById.get(i.category_id) : null
              return (
                <tr key={i.id} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg)]">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[var(--text)]">{i.name}</div>
                    {i.sku && <div className="text-[10px] text-[var(--text-tertiary)]">SKU: {i.sku}</div>}
                    {!i.is_active && <div className="text-[10px] text-[var(--danger)]">Inactive</div>}
                  </td>
                  <td className="px-3 py-2">
                    {category ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-[var(--navy)]">
                        {category.name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{i.unit}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{i.pack_size ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{i.vendor ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                    {i.min_stock_alert !== null ? Number(i.min_stock_alert) : '—'}
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono font-semibold',
                    i.min_stock_alert !== null && total < Number(i.min_stock_alert) ? 'text-[var(--warning)]' : 'text-[var(--text)]',
                  )}>
                    {total}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(i)}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-gray-100"
                        aria-label={`Edit ${i.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(i.is_active ? `Deactivate "${i.name}"?` : `Reactivate "${i.name}"?`)) {
                            deactivateMutation.mutate({ id: i.id, active: !i.is_active })
                          }
                        }}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                        aria-label={i.is_active ? `Deactivate ${i.name}` : `Reactivate ${i.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {displayed.length === 0 ? (
          <Card><p className="text-sm text-[var(--text-secondary)] text-center py-4">No items match.</p></Card>
        ) : displayed.map(i => {
          const total = totalsByItem.get(i.id) ?? 0
          const category = i.category_id ? categoryById.get(i.category_id) : null
          const isLow = i.min_stock_alert !== null && total < Number(i.min_stock_alert)
          return (
            <Card key={i.id} padding="sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text)] truncate">{i.name}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                    {category?.name ?? 'Uncategorized'} · {i.unit}
                    {i.vendor ? ` · ${i.vendor}` : ''}
                  </p>
                </div>
                <div className={cn('font-mono font-semibold text-lg', isLow && 'text-[var(--warning)]')}>
                  {total}
                </div>
              </div>
              <div className="flex gap-1 justify-end mt-2">
                <button
                  onClick={() => openEdit(i)}
                  className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-gray-100"
                  aria-label={`Edit ${i.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(i.is_active ? `Deactivate "${i.name}"?` : `Reactivate "${i.name}"?`)) {
                      deactivateMutation.mutate({ id: i.id, active: !i.is_active })
                    }
                  }}
                  className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                  aria-label={i.is_active ? `Deactivate ${i.name}` : `Reactivate ${i.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── LOCATIONS TAB ──────────────────────────────────────────────────────────

interface LocationsTabProps {
  companyId: string
  queryClient: ReturnType<typeof useQueryClient>
}

function LocationsTab({ companyId, queryClient }: LocationsTabProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryLocationFormValue | null>(null)

  const { data: locations = [] } = useQuery<LocationRow[]>({
    queryKey: ['inventory_locations', companyId, showInactive],
    queryFn: async () => {
      let query = supabase
        .from('inventory_locations')
        .select('id, name, type, assigned_to, license_plate, notes, is_active')
        .eq('company_id', companyId)
        .order('name')
      if (!showInactive) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as LocationRow[]
    },
  })

  const assignedIds = useMemo(() => {
    const s = new Set<string>()
    for (const l of locations) if (l.assigned_to) s.add(l.assigned_to)
    return Array.from(s)
  }, [locations])

  const { data: profiles = [] } = useQuery({
    queryKey: ['inventory_assigned_profiles', assignedIds],
    enabled: assignedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assignedIds)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>
    },
  })

  const profileById = useMemo(() => {
    const m = new Map<string, { full_name: string | null; email: string | null }>()
    for (const p of profiles) m.set(p.id, p)
    return m
  }, [profiles])

  const deactivateMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('inventory_locations')
        .update({ is_active: active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_locations'] })
    },
  })

  const openNew = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: LocationRow) => {
    setEditing({
      id: row.id,
      name: row.name,
      type: row.type,
      assigned_to: row.assigned_to,
      license_plate: row.license_plate,
      notes: row.notes,
      is_active: row.is_active,
    })
    setFormOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Locations" />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-2">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
          <Button size="sm" onClick={openNew}>
            <Plus size={13} />
            Add location
          </Button>
        </div>
      </div>

      {formOpen && (
        <InventoryLocationForm
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      )}

      {locations.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">
            No locations yet. Add a shop, truck, or trailer to get started.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {locations.map(l => {
            const assigned = l.assigned_to ? profileById.get(l.assigned_to) : null
            return (
              <Card key={l.id} padding="md" className={cn(!l.is_active && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin size={14} className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)] truncate">{l.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <LocationTypePill type={l.type} />
                        {!l.is_active && <span className="text-[10px] text-[var(--danger)]">Inactive</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(l)}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-gray-100"
                      aria-label={`Edit ${l.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(l.is_active ? `Deactivate "${l.name}"?` : `Reactivate "${l.name}"?`)) {
                          deactivateMutation.mutate({ id: l.id, active: !l.is_active })
                        }
                      }}
                      className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                      aria-label={l.is_active ? `Deactivate ${l.name}` : `Reactivate ${l.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                  {assigned && (
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-[var(--text-tertiary)]" />
                      <span>{assigned.full_name ?? assigned.email ?? 'Unknown'}</span>
                    </div>
                  )}
                  {l.license_plate && (
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      Plate: {l.license_plate}
                    </div>
                  )}
                  {l.notes && (
                    <p className="text-[11px] text-[var(--text-tertiary)] line-clamp-2">{l.notes}</p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
