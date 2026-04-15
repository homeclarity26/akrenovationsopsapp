import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package, Search, Minus, Plus, ChevronDown, ChevronRight,
  Truck, Warehouse, Container, MapPin, Pencil, AlertTriangle,
  CheckCircle2, X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useInventoryRealtime } from '@/hooks/useInventoryRealtime'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror PR 7 schema (see 20260415000600_inventory_schema.sql)
// ─────────────────────────────────────────────────────────────────────────────

type LocationType = 'shop' | 'truck' | 'trailer' | 'jobsite' | 'other'
type Confidence = 'exact' | 'rough' | 'estimate'

interface InventoryLocation {
  id: string
  company_id: string
  name: string
  type: LocationType
  assigned_to: string | null
  license_plate: string | null
  notes: string | null
  is_active: boolean
}

interface InventoryCategory {
  id: string
  company_id: string
  name: string
  sort_order: number
  icon: string | null
}

interface InventoryItem {
  id: string
  company_id: string
  category_id: string | null
  name: string
  sku: string | null
  unit: string
  pack_size: number | null
  vendor: string | null
  target_stock_total: number | null
  min_stock_alert: number | null
  notes: string | null
  is_active: boolean
}

interface InventoryStock {
  id: string
  location_id: string
  item_id: string
  quantity: number
  last_counted_at: string | null
  last_counted_by: string | null
  notes: string | null
}

interface LocationItemRow {
  item: InventoryItem
  stock: InventoryStock | null
}

// Per-item working state — what the user has typed/adjusted but not submitted.
interface PendingCount {
  quantity: number
  confidence: Confidence
  notes: string
  touched: boolean  // true once the user interacted (even if value matches baseline)
}

const LS_LOCATION_KEY = 'ak_stocktake_location'

// Sort order for location types — shop first, then trucks, trailers, jobsite,
// other — matches the physical flow Adam described.
const LOCATION_TYPE_ORDER: Record<LocationType, number> = {
  shop:    10,
  truck:   20,
  trailer: 30,
  jobsite: 40,
  other:   50,
}

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  shop:    'Shop',
  truck:   'Truck',
  trailer: 'Trailer',
  jobsite: 'Jobsite',
  other:   'Other',
}

const LOCATION_TYPE_ICONS: Record<LocationType, typeof Warehouse> = {
  shop:    Warehouse,
  truck:   Truck,
  trailer: Container,
  jobsite: MapPin,
  other:   Package,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never counted'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'Never counted'
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

function clampQty(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function EmployeeStocktakePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Subscribe to realtime inventory changes so live admin edits & peer submissions
  // propagate automatically.
  useInventoryRealtime()

  // ── Location selection ─────────────────────────────────────────────────────
  const [locationId, setLocationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_LOCATION_KEY)
    } catch {
      return null
    }
  })

  // Locations query — company-scoped, active only. RLS also enforces company scope.
  const { data: locations = [], isLoading: locationsLoading } = useQuery<InventoryLocation[]>({
    queryKey: ['inventory_locations', user?.company_id],
    enabled: !!user?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, company_id, name, type, assigned_to, license_plate, notes, is_active')
        .eq('company_id', user!.company_id!)
        .eq('is_active', true)
      if (error) throw error
      return (data ?? []) as InventoryLocation[]
    },
  })

  const sortedLocations = useMemo(() => {
    const list = [...locations]
    list.sort((a, b) => {
      // Pin the user's assigned truck/location to the top
      const aMine = a.assigned_to === user?.id ? 0 : 1
      const bMine = b.assigned_to === user?.id ? 0 : 1
      if (aMine !== bMine) return aMine - bMine
      // Then by type order (shop → truck → trailer → jobsite → other)
      const aT = LOCATION_TYPE_ORDER[a.type] ?? 99
      const bT = LOCATION_TYPE_ORDER[b.type] ?? 99
      if (aT !== bT) return aT - bT
      return a.name.localeCompare(b.name)
    })
    return list
  }, [locations, user?.id])

  const pickedLocation = useMemo(
    () => locations.find(l => l.id === locationId) ?? null,
    [locations, locationId],
  )

  // If the saved location id no longer matches anything (deleted, other company),
  // clear it so the picker re-appears.
  useEffect(() => {
    if (!locationsLoading && locationId && !pickedLocation) {
      setLocationId(null)
      try { localStorage.removeItem(LS_LOCATION_KEY) } catch { /* ignore */ }
    }
  }, [locationsLoading, locationId, pickedLocation])

  function selectLocation(id: string) {
    setLocationId(id)
    try { localStorage.setItem(LS_LOCATION_KEY, id) } catch { /* ignore */ }
  }

  function clearLocation() {
    setLocationId(null)
    try { localStorage.removeItem(LS_LOCATION_KEY) } catch { /* ignore */ }
    setPending({})
    setSearch('')
    setShowLowOnly(false)
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ['inventory_categories', user?.company_id],
    enabled: !!user?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('id, company_id, name, sort_order, icon')
        .eq('company_id', user!.company_id!)
      if (error) throw error
      return (data ?? []) as InventoryCategory[]
    },
  })

  // ── Items + current stock at picked location ──────────────────────────────
  // We fetch items, then separately fetch the stock rows for the picked
  // location. Items with no stock row simply show quantity 0 (LEFT JOIN in
  // application code — Supabase's implicit join is limited here).
  const { data: itemsAndStock, isLoading: itemsLoading } = useQuery<{
    rows: LocationItemRow[]
  }>({
    queryKey: ['inventory_location_items', user?.company_id, locationId],
    enabled: !!user?.company_id && !!locationId,
    queryFn: async () => {
      const [itemsRes, stockRes] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('id, company_id, category_id, name, sku, unit, pack_size, vendor, target_stock_total, min_stock_alert, notes, is_active')
          .eq('company_id', user!.company_id!)
          .eq('is_active', true),
        supabase
          .from('inventory_stock')
          .select('id, location_id, item_id, quantity, last_counted_at, last_counted_by, notes')
          .eq('location_id', locationId!),
      ])
      if (itemsRes.error) throw itemsRes.error
      if (stockRes.error) throw stockRes.error

      const items = (itemsRes.data ?? []) as InventoryItem[]
      const stock = (stockRes.data ?? []) as InventoryStock[]
      const stockByItem = new Map(stock.map(s => [s.item_id, s]))

      const rows: LocationItemRow[] = items.map(i => ({
        item: i,
        stock: stockByItem.get(i.id) ?? null,
      }))
      return { rows }
    },
  })
  const rows = itemsAndStock?.rows ?? []

  // ── Local editing state ────────────────────────────────────────────────────
  const [pending, setPending] = useState<Record<string, PendingCount>>({})
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)

  // Baseline quantity for an item at this location (0 if no stock row).
  function baselineQty(itemId: string): number {
    const r = rows.find(r => r.item.id === itemId)
    return r?.stock?.quantity ?? 0
  }

  function getPending(itemId: string): PendingCount {
    return pending[itemId] ?? {
      quantity: baselineQty(itemId),
      confidence: 'rough',
      notes: '',
      touched: false,
    }
  }

  function updatePending(itemId: string, patch: Partial<PendingCount>) {
    setPending(prev => {
      const cur = prev[itemId] ?? {
        quantity: baselineQty(itemId),
        confidence: 'rough' as Confidence,
        notes: '',
        touched: false,
      }
      return {
        ...prev,
        [itemId]: { ...cur, ...patch, touched: true },
      }
    })
  }

  // Rows that qualify for submission:
  //   - user touched them AND
  //   - either the qty differs from baseline, or they added a note
  const changedItemIds = useMemo(() => {
    const ids: string[] = []
    for (const [itemId, pc] of Object.entries(pending)) {
      if (!pc.touched) continue
      const base = baselineQty(itemId)
      const qtyChanged = clampQty(pc.quantity) !== base
      const hasNote = pc.notes.trim().length > 0
      if (qtyChanged || hasNote) ids.push(itemId)
    }
    return ids
    // rows is included so the baseline recomputes if stock refreshes mid-count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, rows])

  // ── Filtering & grouping ───────────────────────────────────────────────────
  const lowItemIds = useMemo(() => {
    // Simple heuristic (per spec): flag items with min_stock_alert set
    // AND this location's quantity is 0.
    const ids = new Set<string>()
    for (const r of rows) {
      if (r.item.min_stock_alert == null) continue
      const q = r.stock?.quantity ?? 0
      if (q === 0) ids.add(r.item.id)
    }
    return ids
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (showLowOnly && !lowItemIds.has(r.item.id)) return false
      if (!q) return true
      return (
        r.item.name.toLowerCase().includes(q) ||
        (r.item.sku?.toLowerCase().includes(q) ?? false) ||
        (r.item.vendor?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [rows, search, showLowOnly, lowItemIds])

  // Group by category. Uncategorized (category_id null) goes into a bucket
  // keyed "__uncat__".
  const categoryMap = useMemo(() => {
    const map = new Map<string, InventoryCategory>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const grouped = useMemo(() => {
    const buckets = new Map<string, LocationItemRow[]>()
    for (const r of filteredRows) {
      const key = r.item.category_id ?? '__uncat__'
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(r)
    }
    // Order groups by category.sort_order then name; uncategorized last.
    const groups = Array.from(buckets.entries()).map(([key, list]) => ({
      key,
      category: key === '__uncat__' ? null : categoryMap.get(key) ?? null,
      items: list.sort((a, b) => a.item.name.localeCompare(b.item.name)),
    }))
    groups.sort((a, b) => {
      if (a.key === '__uncat__') return 1
      if (b.key === '__uncat__') return -1
      const as = a.category?.sort_order ?? 999
      const bs = b.category?.sort_order ?? 999
      if (as !== bs) return as - bs
      return (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
    })
    return groups
  }, [filteredRows, categoryMap])

  function toggleCategory(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Submission ─────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !locationId) throw new Error('Missing user or location')
      if (changedItemIds.length === 0) return { inserted: 0 }

      const inserts = changedItemIds.map(itemId => {
        const pc = pending[itemId]!
        return {
          location_id: locationId,
          item_id: itemId,
          counted_by: user.id,
          quantity_after: clampQty(pc.quantity),
          confidence: pc.confidence,
          notes: pc.notes.trim() || null,
          // DO NOT set quantity_before — the BEFORE-INSERT trigger fills it
          // from current inventory_stock.quantity.
        }
      })

      const { error } = await supabase.from('inventory_stocktakes').insert(inserts)
      if (error) throw error
      return { inserted: inserts.length }
    },
    onSuccess: (res) => {
      setPending({})
      queryClient.invalidateQueries({ queryKey: ['inventory_location_items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory_stock'] })
      setToast(`Submitted ${res.inserted} count${res.inserted === 1 ? '' : 's'}`)
      setTimeout(() => setToast(null), 3500)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Submit failed'
      setToast(`Error: ${msg}`)
      setTimeout(() => setToast(null), 5000)
    },
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  // Phase 1 — location picker
  if (!locationId || !pickedLocation) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <PageHeader title="Stocktake" subtitle="Pick the location you're counting from today" />

        {locationsLoading ? (
          <Card>
            <p className="text-center text-sm text-[var(--text-tertiary)] py-6">Loading locations…</p>
          </Card>
        ) : sortedLocations.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Package size={28} className="text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                No inventory locations yet. Ask an admin to add trucks, trailers, or the shop.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedLocations.map(loc => {
              const Icon = LOCATION_TYPE_ICONS[loc.type] ?? Package
              const isMine = loc.assigned_to === user?.id
              return (
                <button
                  key={loc.id}
                  onClick={() => selectLocation(loc.id)}
                  className="w-full text-left min-h-[44px]"
                >
                  <Card className="flex items-center gap-3 hover:border-[var(--navy)] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center flex-shrink-0">
                      <Icon size={20} className="text-[var(--navy)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-[var(--text)] truncate">{loc.name}</p>
                        {isMine && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-white bg-[var(--rust)] rounded px-1.5 py-0.5">
                            Your truck
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        <span className="inline-flex items-center gap-1 bg-[var(--bg)] rounded px-1.5 py-0.5 font-medium">
                          {LOCATION_TYPE_LABELS[loc.type]}
                        </span>
                        {loc.license_plate && <span>· {loc.license_plate}</span>}
                      </div>
                      {loc.notes && (
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1 line-clamp-1">{loc.notes}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
                  </Card>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Phase 2 — counting view
  const LocIcon = LOCATION_TYPE_ICONS[pickedLocation.type] ?? Package
  const changedCount = changedItemIds.length

  return (
    <div className="max-w-2xl mx-auto p-4 pb-28 space-y-4">
      {/* Header with location + change link */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white border border-[var(--border-light)] flex items-center justify-center flex-shrink-0">
          <LocIcon size={20} className="text-[var(--navy)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[22px] leading-tight text-[var(--navy)] truncate">
            {pickedLocation.name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">
              {LOCATION_TYPE_LABELS[pickedLocation.type]}
            </span>
            <button
              onClick={clearLocation}
              className="text-[11px] font-semibold text-[var(--rust)] hover:underline"
            >
              Change location
            </button>
          </div>
        </div>
      </div>

      {/* Low-stock dashboard card */}
      {lowItemIds.size > 0 && (
        <Card
          className={cn(
            'border-[var(--warning)]/40 bg-[var(--warning-bg)] cursor-pointer',
            showLowOnly && 'ring-2 ring-[var(--warning)]',
          )}
          onClick={() => setShowLowOnly(v => !v)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-[var(--warning)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">
                {lowItemIds.size} {lowItemIds.size === 1 ? 'item' : 'items'} low at this location
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {showLowOnly ? 'Tap to show all items' : 'Tap to filter to these items'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full h-11 pl-9 pr-3 bg-white border border-[var(--border-light)] rounded-xl text-sm focus:outline-none focus:border-[var(--navy)]"
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[var(--navy)] text-white text-sm font-medium rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2 max-w-[90vw]">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {itemsLoading ? (
        <Card>
          <p className="text-center text-sm text-[var(--text-tertiary)] py-6">Loading items…</p>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Package size={28} className="text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {rows.length === 0
                ? 'No items in the catalog yet. Ask an admin to add some.'
                : 'No items match your filters.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const key = group.key
            const isCollapsed = collapsed[key] ?? false
            return (
              <div key={key} className="space-y-2">
                <button
                  onClick={() => toggleCategory(key)}
                  className="w-full flex items-center justify-between px-1 py-1 min-h-[44px]"
                >
                  <h2 className="uppercase text-[13px] font-semibold tracking-[0.06em] text-[var(--text)] font-body">
                    {group.category?.name ?? 'Uncategorized'}{' '}
                    <span className="text-[11px] font-normal text-[var(--text-tertiary)] normal-case tracking-normal">
                      · {group.items.length}
                    </span>
                  </h2>
                  {isCollapsed ? (
                    <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
                  ) : (
                    <ChevronDown size={16} className="text-[var(--text-tertiary)]" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {group.items.map(row => (
                      <ItemRow
                        key={row.item.id}
                        row={row}
                        pending={getPending(row.item.id)}
                        isLow={lowItemIds.has(row.item.id)}
                        showNotes={expandedNotes[row.item.id] ?? false}
                        toggleNotes={() =>
                          setExpandedNotes(p => ({ ...p, [row.item.id]: !p[row.item.id] }))
                        }
                        onUpdate={(patch) => updatePending(row.item.id, patch)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky submit */}
      {changedCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="shadow-lg"
            >
              {submitMutation.isPending
                ? 'Submitting…'
                : `Submit ${changedCount} count${changedCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemRow — single item's counting UI
// ─────────────────────────────────────────────────────────────────────────────

interface ItemRowProps {
  row: LocationItemRow
  pending: PendingCount
  isLow: boolean
  showNotes: boolean
  toggleNotes: () => void
  onUpdate: (patch: Partial<PendingCount>) => void
}

function ItemRow({ row, pending, isLow, showNotes, toggleNotes, onUpdate }: ItemRowProps) {
  const { item, stock } = row
  const baseline = stock?.quantity ?? 0
  const qty = pending.quantity
  const changed = pending.touched && (clampQty(qty) !== baseline || pending.notes.trim().length > 0)

  return (
    <Card
      className={cn(
        'transition-colors',
        changed && 'border-[var(--rust)] bg-[var(--rust)]/5',
        !changed && isLow && 'border-[var(--warning)]/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--text)] leading-tight">
            {item.name}
            <span className="text-[11px] font-normal text-[var(--text-tertiary)] ml-1.5">· {item.unit}</span>
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            Last counted: {relativeTime(stock?.last_counted_at)}
            {' · '}
            Current: <span className="font-semibold text-[var(--text-secondary)]">{baseline}</span>
          </p>
          {isLow && (
            <p className="text-[11px] text-[var(--warning)] font-medium mt-0.5 flex items-center gap-1">
              <AlertTriangle size={11} /> Low here — flagged for reorder
            </p>
          )}
        </div>
      </div>

      {/* Counter controls */}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => onUpdate({ quantity: clampQty(qty - 1) })}
          className="w-11 h-11 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Decrease"
        >
          <Minus size={18} />
        </button>

        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(qty) ? qty : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onUpdate({ quantity: Number.isNaN(v) ? 0 : clampQty(v) })
          }}
          className="flex-1 h-11 text-center text-lg font-bold bg-white border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--navy)]"
        />

        <button
          type="button"
          onClick={() => onUpdate({ quantity: clampQty(qty + 1) })}
          className="w-11 h-11 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Increase"
        >
          <Plus size={18} />
        </button>

        {item.pack_size && item.pack_size > 0 && (
          <button
            type="button"
            onClick={() => onUpdate({ quantity: clampQty(qty + (item.pack_size ?? 0)) })}
            className="h-11 px-3 rounded-lg bg-[var(--navy)] text-white text-xs font-semibold active:scale-95 transition-transform whitespace-nowrap"
          >
            +{item.pack_size}
          </button>
        )}
      </div>

      {/* Confidence + notes toggle row */}
      <div className="flex items-center gap-2 mt-3">
        <select
          value={pending.confidence}
          onChange={(e) => onUpdate({ confidence: e.target.value as Confidence })}
          className="h-10 min-w-[110px] px-2 rounded-lg bg-white border border-[var(--border)] text-xs font-medium focus:outline-none focus:border-[var(--navy)]"
          aria-label="Confidence"
        >
          <option value="rough">Rough count</option>
          <option value="exact">Exact</option>
          <option value="estimate">Estimate</option>
        </select>

        <button
          type="button"
          onClick={toggleNotes}
          className={cn(
            'h-10 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-medium',
            pending.notes.trim().length > 0
              ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
              : 'bg-white text-[var(--text-secondary)] border-[var(--border)]',
          )}
        >
          <Pencil size={12} />
          {pending.notes.trim().length > 0 ? 'Note added' : 'Add note'}
        </button>

        {changed && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[var(--rust)]">
            Changed
          </span>
        )}
      </div>

      {showNotes && (
        <textarea
          value={pending.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Optional note (e.g. 'opened box, half used')"
          rows={2}
          className="w-full mt-2 px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--navy)]"
        />
      )}
    </Card>
  )
}
