import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export interface InventoryItemFormValue {
  id?: string
  name: string
  sku: string | null
  category_id: string | null
  unit: string
  pack_size: number | null
  vendor: string | null
  target_stock_total: number | null
  min_stock_alert: number | null
  notes: string | null
  is_active: boolean
}

interface Props {
  initial?: InventoryItemFormValue | null
  onClose: () => void
}

const EMPTY: InventoryItemFormValue = {
  name: '',
  sku: null,
  category_id: null,
  unit: 'each',
  pack_size: null,
  vendor: null,
  target_stock_total: null,
  min_stock_alert: null,
  notes: null,
  is_active: true,
}

export function InventoryItemForm({ initial, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const companyId = user?.company_id ?? undefined
  const [value, setValue] = useState<InventoryItemFormValue>(initial ?? EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  useEffect(() => {
    setValue(initial ?? EMPTY)
  }, [initial])

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory_categories', companyId],
    enabled: !!companyId,
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

  const { data: templates = [] } = useQuery({
    queryKey: ['inventory_item_templates', companyId],
    enabled: !!companyId && templatesOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_item_templates')
        .select('id, category_name, name, unit, typical_pack_size, typical_vendor, notes')
        .eq('company_id', companyId)
        .order('category_name')
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        category_name: string
        name: string
        unit: string
        typical_pack_size: number | null
        typical_vendor: string | null
        notes: string | null
      }>
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (v: InventoryItemFormValue) => {
      if (!companyId) throw new Error('Company not loaded')
      if (!v.name.trim()) throw new Error('Name is required')

      const payload = {
        company_id: companyId,
        category_id: v.category_id,
        name: v.name.trim(),
        sku: v.sku?.trim() || null,
        unit: v.unit.trim() || 'each',
        pack_size: v.pack_size,
        vendor: v.vendor?.trim() || null,
        target_stock_total: v.target_stock_total,
        min_stock_alert: v.min_stock_alert,
        notes: v.notes?.trim() || null,
        is_active: v.is_active,
      }

      if (v.id) {
        const { error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', v.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory_stock'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const applyTemplate = (t: (typeof templates)[number]) => {
    const matchedCategory = categories.find(c => c.name.toLowerCase() === t.category_name.toLowerCase())
    setValue(v => ({
      ...v,
      name: t.name,
      unit: t.unit ?? 'each',
      pack_size: t.typical_pack_size ?? null,
      vendor: t.typical_vendor ?? null,
      notes: t.notes ?? v.notes,
      category_id: matchedCategory?.id ?? v.category_id,
    }))
    setTemplatesOpen(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    saveMutation.mutate(value)
  }

  const numberOrNull = (s: string): number | null => {
    if (s.trim() === '') return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text)]">
            {value.id ? 'Edit item' : 'Add item'}
          </p>
          {!value.id && (
            <button
              type="button"
              onClick={() => setTemplatesOpen(o => !o)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--navy)] hover:underline"
            >
              <Sparkles size={12} />
              Start from template
            </button>
          )}
        </div>

        {templatesOpen && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 max-h-64 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)] p-2">No templates available.</p>
            ) : (
              <ul className="space-y-1">
                {templates.map(t => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white"
                    >
                      <p className="text-xs font-semibold text-[var(--text)]">{t.name}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        {t.category_name} · {t.unit}
                        {t.typical_vendor ? ` · ${t.typical_vendor}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Name</label>
          <input
            autoFocus
            type="text"
            required
            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
            value={value.name}
            onChange={e => setValue(v => ({ ...v, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Category</label>
            <select
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.category_id ?? ''}
              onChange={e => setValue(v => ({ ...v, category_id: e.target.value || null }))}
            >
              <option value="">No category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">SKU</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.sku ?? ''}
              onChange={e => setValue(v => ({ ...v, sku: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Unit</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.unit}
              onChange={e => setValue(v => ({ ...v, unit: e.target.value }))}
              placeholder="each"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Pack size</label>
            <input
              type="number"
              step="any"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.pack_size ?? ''}
              onChange={e => setValue(v => ({ ...v, pack_size: numberOrNull(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Vendor</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.vendor ?? ''}
              onChange={e => setValue(v => ({ ...v, vendor: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Min alert</label>
            <input
              type="number"
              step="any"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.min_stock_alert ?? ''}
              onChange={e => setValue(v => ({ ...v, min_stock_alert: numberOrNull(e.target.value) }))}
              placeholder="Flag when total drops below"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Target total</label>
            <input
              type="number"
              step="any"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.target_stock_total ?? ''}
              onChange={e => setValue(v => ({ ...v, target_stock_total: numberOrNull(e.target.value) }))}
              placeholder="Across all locations"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Notes</label>
          <textarea
            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] min-h-[60px]"
            value={value.notes ?? ''}
            onChange={e => setValue(v => ({ ...v, notes: e.target.value }))}
          />
        </div>

        {value.id && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.is_active}
              onChange={e => setValue(v => ({ ...v, is_active: e.target.checked }))}
            />
            <span className="text-xs text-[var(--text-secondary)]">Active</span>
          </label>
        )}

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : value.id ? 'Save' : 'Add item'}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}
