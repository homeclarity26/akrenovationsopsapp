import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { LocationType } from './LocationTypePill'

export interface InventoryLocationFormValue {
  id?: string
  name: string
  type: LocationType
  assigned_to: string | null
  license_plate: string | null
  notes: string | null
  is_active: boolean
}

interface Props {
  initial?: InventoryLocationFormValue | null
  onClose: () => void
}

const TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'shop',    label: 'Shop' },
  { value: 'truck',   label: 'Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'jobsite', label: 'Jobsite' },
  { value: 'other',   label: 'Other' },
]

const EMPTY: InventoryLocationFormValue = {
  name: '',
  type: 'shop',
  assigned_to: null,
  license_plate: null,
  notes: null,
  is_active: true,
}

export function InventoryLocationForm({ initial, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const companyId = user?.company_id ?? undefined
  const [value, setValue] = useState<InventoryLocationFormValue>(initial ?? EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(initial ?? EMPTY)
  }, [initial])

  const { data: employees = [] } = useQuery({
    queryKey: ['inventory_profiles_for_assignment', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', companyId)
        .in('role', ['employee', 'admin'])
        .order('full_name')
      if (error) throw error
      return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (v: InventoryLocationFormValue) => {
      if (!companyId) throw new Error('Company not loaded')
      if (!v.name.trim()) throw new Error('Name is required')

      const payload = {
        company_id: companyId,
        name: v.name.trim(),
        type: v.type,
        assigned_to: v.assigned_to,
        license_plate: v.license_plate?.trim() || null,
        notes: v.notes?.trim() || null,
        is_active: v.is_active,
      }

      if (v.id) {
        const { error } = await supabase
          .from('inventory_locations')
          .update(payload)
          .eq('id', v.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory_locations')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_locations'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    saveMutation.mutate(value)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm font-semibold text-[var(--text)]">
          {value.id ? 'Edit location' : 'Add location'}
        </p>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Name</label>
          <input
            autoFocus
            type="text"
            required
            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
            value={value.name}
            onChange={e => setValue(v => ({ ...v, name: e.target.value }))}
            placeholder="Main Shop, Truck 1, Trailer — Bathroom Jobs..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Type</label>
            <select
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.type}
              onChange={e => setValue(v => ({ ...v, type: e.target.value as LocationType }))}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">License plate</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
              value={value.license_plate ?? ''}
              onChange={e => setValue(v => ({ ...v, license_plate: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Assigned to</label>
          <select
            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
            value={value.assigned_to ?? ''}
            onChange={e => setValue(v => ({ ...v, assigned_to: e.target.value || null }))}
          >
            <option value="">Nobody</option>
            {employees.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email ?? p.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Notes</label>
          <textarea
            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)] min-h-[70px]"
            value={value.notes ?? ''}
            onChange={e => setValue(v => ({ ...v, notes: e.target.value }))}
            placeholder="Optional"
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
            {saveMutation.isPending ? 'Saving...' : value.id ? 'Save' : 'Add location'}
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
