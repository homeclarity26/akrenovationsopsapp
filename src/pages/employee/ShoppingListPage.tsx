import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Check, ArrowLeft, Trash2, Link2, X as XIcon, PackageMinus, CircleCheck, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { InventoryItemPicker } from '@/components/inventory/InventoryItemPicker'

interface InventoryItemRef {
  id: string
  name: string
}

interface InventoryLocationRef {
  id: string
  name: string
  type: string
  is_active: boolean
}

interface ShoppingItem {
  id: string
  item_name: string
  quantity: number | null
  unit: string | null
  notes: string | null
  status: string
  project_id: string | null
  project_title?: string
  // PR 10 inventory integration columns
  inventory_item_id: string | null
  source_location_id: string | null
  deducted_at: string | null
  deducted_stocktake_id: string | null
  inventory_items: InventoryItemRef | null
}

interface ActiveProject {
  id: string
  title: string
}

export function ShoppingListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  // ── add-item sheet state ──────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState<number>(1)
  const [newUnit, setNewUnit] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // ── inventory picker state ───────────────────────────────────────
  // `pickerForItemId` = id of the shopping row the picker is linking to.
  const [pickerForItemId, setPickerForItemId] = useState<string | null>(null)

  // ── fetch items ───────────────────────────────────────────────────
  const { data: rawItems = [], isLoading, error: itemsError, refetch: itemsRefetch } = useQuery({
    queryKey: ['shopping-list-items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('shopping_list_items')
        .select(
          'id, item_name, quantity, unit, notes, status, project_id, inventory_item_id, source_location_id, deducted_at, deducted_stocktake_id, projects(title), inventory_items(id, name)',
        )
        .order('created_at', { ascending: false })
      return (data ?? []).map((i: any) => ({
        ...i,
        project_title: i.projects?.title ?? 'No Project',
        inventory_items: i.inventory_items ?? null,
      })) as ShoppingItem[]
    },
  })

  // ── fetch active projects for the dropdown ─────────────────────────
  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title')
        .eq('status', 'active')
        .order('title')
      return (data ?? []) as ActiveProject[]
    },
  })

  // ── fetch active inventory locations (admin only, for source picker) ──
  const { data: locations = [] } = useQuery({
    queryKey: ['inventory-locations-for-shopping', user?.company_id],
    enabled: isAdmin && !!user?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_locations')
        .select('id, name, type, is_active')
        .eq('company_id', user!.company_id!)
        .eq('is_active', true)
        .order('type') // 'shop' sorts before 'trailer'/'truck' alphabetically
        .order('name')
      return (data ?? []) as InventoryLocationRef[]
    },
  })

  // shop-first ordering: put 'shop' types first, everything else alphabetical.
  const orderedLocations = [...locations].sort((a, b) => {
    if (a.type === 'shop' && b.type !== 'shop') return -1
    if (b.type === 'shop' && a.type !== 'shop') return 1
    return a.name.localeCompare(b.name)
  })

  // ── optimistic local overrides ────────────────────────────────────
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({})
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})

  // Inline banner for deduct errors/warnings. Auto-dismisses after 4s.
  // Replaces window.alert for mobile-friendliness and consistency with the
  // rest of the app (UX review flagged the alert pattern).
  const [banner, setBanner] = useState<
    { kind: 'error' | 'warning' | 'success'; text: string } | null
  >(null)
  const showBanner = (kind: 'error' | 'warning' | 'success', text: string) => {
    setBanner({ kind, text })
    setTimeout(() => {
      setBanner((b) => (b && b.text === text ? null : b))
    }, 4000)
  }

  const items: ShoppingItem[] = rawItems.map(i => ({
    ...i,
    status: localOverrides[i.id] ?? i.status,
  }))

  const needed = items.filter(i => i.status === 'needed')
  const purchased = items.filter(i => i.status !== 'needed')

  // Group needed items by project
  const grouped: Record<string, ShoppingItem[]> = {}
  for (const item of needed) {
    const key = item.project_title ?? 'No Project'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  // ── toggle needed ↔ purchased ─────────────────────────────────────
  // Admin-only: when marking an item "delivered"/purchased and it has a
  // linked inventory item + source location, also auto-deduct from stock.
  const toggle = async (id: string, opts?: { autoDeduct?: boolean }) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newStatus = item.status === 'needed' ? 'purchased' : 'needed'
    setLocalOverrides(prev => ({ ...prev, [id]: newStatus }))
    await supabase.from('shopping_list_items').update({ status: newStatus }).eq('id', id)

    // Auto-deduct path — admins, transitioning to purchased, linked + not
    // already deducted. UI offers a checkbox; if we get here we honor it.
    if (
      isAdmin &&
      newStatus === 'purchased' &&
      opts?.autoDeduct &&
      item.inventory_item_id &&
      item.source_location_id &&
      !item.deducted_at
    ) {
      await deductFromStock(id)
    }

    queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
  }

  // ── deduct from stock (admin) ────────────────────────────────────
  const deductFromStock = async (id: string) => {
    setBusyIds(prev => ({ ...prev, [id]: true }))
    try {
      const { data, error } = await supabase.functions.invoke('deduct-shopping-item-from-stock', {
        body: { shopping_list_item_id: id },
      })
      if (error) {
        showBanner('error', `Could not deduct: ${error.message}`)
        return
      }
      if (data?.warning) {
        showBanner('warning', `Deducted with a warning: ${data.warning}`)
      }
      queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
    } finally {
      setBusyIds(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  // ── link / unlink inventory ──────────────────────────────────────
  const saveInventoryLink = async (rowId: string, inventoryItemId: string | null) => {
    // When unlinking, also clear source location so the UI never offers to
    // deduct against a stale link.
    const patch: Record<string, unknown> = { inventory_item_id: inventoryItemId }
    if (inventoryItemId === null) patch.source_location_id = null
    await supabase.from('shopping_list_items').update(patch).eq('id', rowId)
    queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
  }

  const saveSourceLocation = async (rowId: string, locationId: string | null) => {
    await supabase
      .from('shopping_list_items')
      .update({ source_location_id: locationId })
      .eq('id', rowId)
    queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
  }

  // ── clear purchased ───────────────────────────────────────────────
  const clearPurchased = async () => {
    if (!purchased.length) return
    const ok = window.confirm('Clear all purchased items?')
    if (!ok) return
    const ids = purchased.map(i => i.id)
    await supabase.from('shopping_list_items').delete().in('id', ids)
    setLocalOverrides(prev => {
      const next = { ...prev }
      ids.forEach(id => delete next[id])
      return next
    })
    queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
  }

  // ── submit new item ───────────────────────────────────────────────
  const submitItem = async () => {
    setFormError('')
    if (!newName.trim()) { setFormError('Item name is required.'); return }
    if (!newProjectId) { setFormError('Please select a project.'); return }
    setSubmitting(true)
    const { error } = await supabase.from('shopping_list_items').insert({
      item_name: newName.trim(),
      quantity: newQty || 1,
      unit: newUnit.trim() || null,
      notes: newNotes.trim() || null,
      project_id: newProjectId,
      status: 'needed',
      added_by: user?.id ?? null,
    })
    setSubmitting(false)
    if (error) { setFormError('Failed to add item. Try again.'); return }
    queryClient.invalidateQueries({ queryKey: ['shopping-list-items'] })
    // reset form
    setNewName('')
    setNewQty(1)
    setNewUnit('')
    setNewNotes('')
    setNewProjectId('')
    setSheetOpen(false)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setFormError('')
  }

  if (itemsError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load shopping list. Check your connection and try again.</p>
      <button onClick={() => itemsRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  // ── loading skeleton ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 pt-4 max-w-lg mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--border)] animate-pulse" />
            <div className="w-32 h-6 rounded bg-[var(--border)] animate-pulse" />
          </div>
          <div className="w-24 h-9 rounded-lg bg-[var(--border)] animate-pulse" />
        </div>
        <Card padding="none">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
              <div className="w-6 h-6 rounded-full bg-[var(--border)] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-[var(--border)] rounded animate-pulse w-2/3" />
                <div className="h-3 bg-[var(--border-light)] rounded animate-pulse w-1/3" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    )
  }

  const pickerRow = pickerForItemId ? items.find(i => i.id === pickerForItemId) : null

  // ── main render ───────────────────────────────────────────────────
  return (
    <>
      <div className="p-4 pt-4 max-w-lg mx-auto pb-24">

        {/* Inline banner — replaces window.alert for deduct feedback */}
        {banner && (
          <div
            className={cn(
              'mb-3 rounded-xl border px-3 py-2.5 flex items-start gap-2',
              banner.kind === 'error' && 'border-[var(--danger)]/40 bg-[var(--danger)]/5',
              banner.kind === 'warning' && 'border-[var(--warning)]/40 bg-[var(--warning-bg)]',
              banner.kind === 'success' && 'border-[var(--success)]/40 bg-[var(--success-bg)]',
            )}
            role="status"
          >
            <AlertTriangle
              size={14}
              className={cn(
                'flex-shrink-0 mt-0.5',
                banner.kind === 'error' && 'text-[var(--danger)]',
                banner.kind === 'warning' && 'text-[var(--warning)]',
                banner.kind === 'success' && 'text-[var(--success)]',
              )}
            />
            <p className="text-xs text-[var(--text-secondary)] flex-1">{banner.text}</p>
            <button
              onClick={() => setBanner(null)}
              className="opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border-light)] transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="font-display text-xl text-[var(--navy)]">Shopping List</h1>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 bg-[var(--navy)] text-white px-3 py-2 rounded-lg text-sm font-medium font-body active:opacity-80 transition-opacity"
          >
            <Plus size={15} />
            Add Item
          </button>
        </div>

        {/* Empty state */}
        {needed.length === 0 && purchased.length === 0 && (
          <div className="text-center py-14">
            <p className="text-sm text-[var(--text-secondary)]">Nothing on the list yet.</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Tap "Add Item" to get started.</p>
          </div>
        )}

        {/* Needed — grouped by project, all in one Card */}
        {needed.length > 0 && (
          <Card padding="none">
            {Object.entries(grouped).map(([project, projectItems], groupIdx) => (
              <div key={project}>
                {/* Project separator label */}
                <p className={cn(
                  'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] px-4 py-2',
                  groupIdx > 0 && 'border-t border-[var(--border-light)]'
                )}>
                  {project}
                </p>
                {projectItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={toggle}
                    isAdmin={isAdmin}
                    locations={orderedLocations}
                    busy={!!busyIds[item.id]}
                    onOpenPicker={() => setPickerForItemId(item.id)}
                    onUnlinkInventory={() => saveInventoryLink(item.id, null)}
                    onChangeSource={(locId) => saveSourceLocation(item.id, locId)}
                    onDeduct={() => deductFromStock(item.id)}
                  />
                ))}
              </div>
            ))}
          </Card>
        )}

        {/* Purchased section */}
        {purchased.length > 0 && (
          <div className="mt-5">
            {/* Section header with Clear button */}
            <div className="flex items-center justify-between px-1 py-2 mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Purchased ({purchased.length})
              </p>
              <button
                onClick={clearPurchased}
                className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors font-medium"
              >
                <Trash2 size={11} />
                Clear
              </button>
            </div>
            <Card padding="none">
              {purchased.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={toggle}
                  showProject
                  isAdmin={isAdmin}
                  locations={orderedLocations}
                  busy={!!busyIds[item.id]}
                  onOpenPicker={() => setPickerForItemId(item.id)}
                  onUnlinkInventory={() => saveInventoryLink(item.id, null)}
                  onChangeSource={(locId) => saveSourceLocation(item.id, locId)}
                  onDeduct={() => deductFromStock(item.id)}
                />
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Inventory picker modal */}
      <InventoryItemPicker
        companyId={user?.company_id}
        open={!!pickerForItemId && isAdmin}
        onClose={() => setPickerForItemId(null)}
        onPick={(picked) => {
          if (pickerRow) void saveInventoryLink(pickerRow.id, picked.id)
        }}
      />

      {/* Add Item bottom sheet overlay */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={closeSheet}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-w-lg mx-auto">
            <div className="px-5 pt-5 pb-8">
              {/* Handle */}
              <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-5" />

              <h2 className="font-display text-lg text-[var(--navy)] mb-4">Add Item</h2>

              <div className="space-y-3">
                {/* Item name */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
                    Item Name <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. 12x24 tile"
                    className="w-full border-[1.5px] border-[var(--border)] rounded-[14px] bg-[var(--bg)] px-3.5 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors"
                    autoFocus
                  />
                </div>

                {/* Quantity + Unit row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newQty}
                      onChange={e => setNewQty(Number(e.target.value))}
                      className="w-full border-[1.5px] border-[var(--border)] rounded-[14px] bg-[var(--bg)] px-3.5 py-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--navy)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={newUnit}
                      onChange={e => setNewUnit(e.target.value)}
                      placeholder="e.g. box, sqft"
                      className="w-full border-[1.5px] border-[var(--border)] rounded-[14px] bg-[var(--bg)] px-3.5 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors"
                    />
                  </div>
                </div>

                {/* Project selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
                    Project <span className="text-[var(--danger)]">*</span>
                  </label>
                  <select
                    value={newProjectId}
                    onChange={e => setNewProjectId(e.target.value)}
                    className="w-full border-[1.5px] border-[var(--border)] rounded-[14px] bg-[var(--bg)] px-3.5 py-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--navy)] transition-colors appearance-none"
                  >
                    <option value="">Select a project...</option>
                    {activeProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    placeholder="Any details..."
                    className="w-full border-[1.5px] border-[var(--border)] rounded-[14px] bg-[var(--bg)] px-3.5 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors"
                  />
                </div>

                {/* Error */}
                {formError && (
                  <p className="text-xs text-[var(--danger)]">{formError}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeSheet}
                    className="flex-1 py-3 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] font-body hover:bg-[var(--border-light)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitItem}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-lg bg-[var(--navy)] text-white text-sm font-medium font-body disabled:opacity-60 active:opacity-80 transition-opacity"
                  >
                    {submitting ? 'Adding...' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Item row sub-component ─────────────────────────────────────────────────

interface ItemRowProps {
  item: ShoppingItem
  onToggle: (id: string, opts?: { autoDeduct?: boolean }) => void | Promise<void>
  showProject?: boolean
  isAdmin: boolean
  locations: InventoryLocationRef[]
  busy: boolean
  onOpenPicker: () => void
  onUnlinkInventory: () => void | Promise<void>
  onChangeSource: (locationId: string | null) => void | Promise<void>
  onDeduct: () => void | Promise<void>
}

function ItemRow({
  item,
  onToggle,
  showProject = false,
  isAdmin,
  locations,
  busy,
  onOpenPicker,
  onUnlinkInventory,
  onChangeSource,
  onDeduct,
}: ItemRowProps) {
  const isPurchased = item.status !== 'needed'
  const isLinked = !!item.inventory_item_id
  const hasSource = !!item.source_location_id
  const deducted = !!item.deducted_at
  const canDeduct = isAdmin && isLinked && hasSource && !deducted

  // Admins get a "also deduct" checkbox next to the status circle. Default
  // checked when everything is wired up — purchased is the delivery signal.
  const [autoDeductChecked, setAutoDeductChecked] = useState(true)

  return (
    <div className="px-4 py-3 border-b border-[var(--border-light)] last:border-0">
      <div className="flex items-start gap-3 min-h-[44px]">
        <button
          onClick={() => onToggle(item.id, { autoDeduct: canDeduct && autoDeductChecked })}
          className={cn(
            'w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
            isPurchased
              ? 'bg-[var(--success)] border-[var(--success)]'
              : 'border-[var(--border)] hover:border-[var(--navy)] active:scale-90',
          )}
          aria-label={isPurchased ? 'Mark as needed' : 'Mark as purchased'}
        >
          {isPurchased && <Check size={13} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium text-[var(--text)] truncate',
            isPurchased && 'line-through text-[var(--text-tertiary)]',
          )}>
            {item.item_name}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(item.quantity != null || item.unit) && (
              <span className="text-xs text-[var(--text-tertiary)]">
                {item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ''}
              </span>
            )}
            {showProject && item.project_title && (
              <span className="text-xs text-[var(--text-tertiary)]">
                {item.quantity != null || item.unit ? '·' : ''} {item.project_title}
              </span>
            )}
            {item.notes && (
              <span className="text-xs text-[var(--text-tertiary)] italic truncate max-w-[160px]">
                {item.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin inventory controls — render below the main row so the mobile
          layout doesn't get squeezed. Employees don't see any of this. */}
      {isAdmin && (
        <div className="pl-9 pt-2 flex flex-wrap items-center gap-2">
          {/* Link chip */}
          {isLinked ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[var(--border-light)] text-[var(--text)] px-2 py-1 rounded-full">
              <Link2 size={11} />
              {item.inventory_items?.name ?? 'Linked item'}
              <button
                onClick={onUnlinkInventory}
                aria-label="Unlink inventory item"
                className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-[var(--border)]"
              >
                <XIcon size={9} />
              </button>
            </span>
          ) : (
            <button
              onClick={onOpenPicker}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--navy)] border border-[var(--border)] px-2 py-1 rounded-full hover:bg-[var(--border-light)] transition-colors"
            >
              <Link2 size={11} />
              Link to inventory
            </button>
          )}

          {/* Source location select (only if linked) */}
          {isLinked && (
            <select
              value={item.source_location_id ?? ''}
              onChange={(e) => onChangeSource(e.target.value || null)}
              disabled={deducted}
              className="text-[11px] border border-[var(--border)] rounded-full px-2 py-1 bg-white text-[var(--text)] focus:outline-none focus:border-[var(--navy)] disabled:opacity-60"
              aria-label="Source location"
            >
              <option value="">Pulling from: select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  Pulling from: {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Deduct button */}
          {canDeduct && (
            <button
              onClick={onDeduct}
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[var(--navy)] px-2 py-1 rounded-full disabled:opacity-60"
            >
              <PackageMinus size={11} />
              {busy ? 'Deducting...' : 'Deduct from stock'}
            </button>
          )}

          {/* Auto-deduct checkbox — shows only when canDeduct and item is
              still in 'needed'. Clicking the status circle will fire the
              deduction in addition to flipping status. */}
          {canDeduct && !isPurchased && (
            <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={autoDeductChecked}
                onChange={(e) => setAutoDeductChecked(e.target.checked)}
                className="w-3 h-3"
              />
              Also deduct on delivery
            </label>
          )}

          {/* Deducted pill */}
          {deducted && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--success)] bg-[var(--success)]/10 px-2 py-1 rounded-full">
              <CircleCheck size={11} />
              Stock deducted
            </span>
          )}
        </div>
      )}
    </div>
  )
}
