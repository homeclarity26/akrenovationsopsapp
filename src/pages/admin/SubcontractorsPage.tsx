import { useState } from 'react'
import { Plus, Phone, Mail, Star, AlertTriangle, Building2, Truck, X, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'
import { cn } from '@/lib/utils'

const TRADE_COLORS: Record<string, string> = {
  electrical:  'bg-yellow-100 text-yellow-700',
  concrete:    'bg-stone-100 text-stone-700',
  plumbing:    'bg-blue-100 text-blue-700',
  hvac:        'bg-cyan-100 text-cyan-700',
  roofing:     'bg-orange-100 text-orange-700',
  framing:     'bg-green-100 text-green-700',
}

const SUPPLIER_CATEGORY_COLORS: Record<string, string> = {
  lumber:          'bg-amber-100 text-amber-700',
  plumbing_supply: 'bg-blue-100 text-blue-700',
  paint_supply:    'bg-pink-100 text-pink-700',
  hardware:        'bg-stone-100 text-stone-700',
  specialty:       'bg-purple-100 text-purple-700',
  tile_flooring:   'bg-orange-100 text-orange-700',
  electrical:      'bg-yellow-100 text-yellow-700',
  appliances:      'bg-cyan-100 text-cyan-700',
  other:           'bg-gray-100 text-gray-600',
}

const SUPPLIER_CATEGORIES = [
  'lumber', 'plumbing_supply', 'paint_supply', 'hardware', 'specialty',
  'tile_flooring', 'electrical', 'appliances', 'other',
]

function insuranceDaysLeft(expiry: string) {
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  return days
}

const TRADES = ['electrical', 'concrete', 'plumbing', 'hvac', 'roofing', 'framing', 'painting', 'drywall', 'flooring', 'landscaping']

interface SupplierRow {
  id: string
  company_id: string
  name: string
  category: string | null
  primary_contact_name: string | null
  phone: string | null
  email: string | null
  website: string | null
  account_number: string | null
  address: string | null
  notes: string | null
  preferred: boolean
  is_active: boolean
}

interface SupplierContactRow {
  id: string
  supplier_id: string
  full_name: string
  title: string | null
  phone: string | null
  email: string | null
  is_primary: boolean
  notes: string | null
}

export function SubcontractorsPage() {
  const { data: companyProfile } = useCompanyProfile()
  const companyId = companyProfile?.id
  const [tab, setTab] = useState<'subs' | 'suppliers'>('subs')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null)
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null)
  const [showAddContactFor, setShowAddContactFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: subs = [], isLoading: subsLoading, error: subsError, refetch: subsRefetch } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      const { data } = await supabase.from('subcontractors').select('*').order('company_name')
      return data ?? []
    },
  })

  const { data: suppliers = [], isLoading: suppliersLoading, error: suppliersError, refetch: suppliersRefetch } = useQuery({
    queryKey: ['suppliers', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as SupplierRow[]
    },
  })

  const { data: supplierContacts = [], refetch: contactsRefetch } = useQuery({
    queryKey: ['supplier_contacts', suppliers.map((s) => s.id).join(',')],
    enabled: suppliers.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_contacts')
        .select('*')
        .in('supplier_id', suppliers.map((s) => s.id))
      if (error) throw error
      return (data ?? []) as SupplierContactRow[]
    },
  })

  const contactsBySupplier = supplierContacts.reduce<Record<string, SupplierContactRow[]>>((acc, c) => {
    acc[c.supplier_id] = acc[c.supplier_id] ?? []
    acc[c.supplier_id].push(c)
    return acc
  }, {})

  if (subsError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load trade partners. Check your connection and try again.</p>
      <button onClick={() => subsRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  const handleDeactivateSupplier = async (supplierId: string) => {
    if (!confirm('Mark this supplier inactive? It will disappear from the list but history is kept.')) return
    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', supplierId)
    if (error) {
      alert('Could not deactivate supplier: ' + error.message)
      return
    }
    suppliersRefetch()
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Trade Partners"
        subtitle={`${subs.length} subs · ${suppliers.length} suppliers`}
        action={
          <Button size="sm" onClick={() => { setEditingSupplier(null); setShowAddForm(true) }}>
            <Plus size={15} />
            {tab === 'subs' ? 'Add Sub' : 'Add Supplier'}
          </Button>
        }
      />

      {/* Add / Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => { setShowAddForm(false); setEditingSupplier(null) }}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-[var(--navy)]">
                {tab === 'subs'
                  ? 'Add Subcontractor'
                  : editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button onClick={() => { setShowAddForm(false); setEditingSupplier(null) }} className="p-1 text-[var(--text-tertiary)]"><X size={18} /></button>
            </div>

            {tab === 'subs' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const companyName = (fd.get('company_name') as string).trim()
                  const trade = fd.get('trade') as string
                  if (!companyName || !trade) return
                  setSaving(true)
                  const { error: insertErr } = await supabase.from('subcontractors').insert({
                    company_name: companyName,
                    contact_name: (fd.get('contact_name') as string).trim() || null,
                    phone: (fd.get('phone') as string).trim() || null,
                    email: (fd.get('email') as string).trim() || null,
                    trade,
                    insurance_expiry: (fd.get('insurance_expiry') as string) || null,
                    license_number: (fd.get('license_number') as string).trim() || null,
                    rating: parseInt(fd.get('rating') as string) || 3,
                    notes: (fd.get('notes') as string).trim() || null,
                  })
                  setSaving(false)
                  if (insertErr) {
                    alert('Error adding subcontractor: ' + insertErr.message)
                    return
                  }
                  setShowAddForm(false)
                  subsRefetch()
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Company Name *</label>
                  <input name="company_name" required placeholder="ABC Electric LLC" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Contact Name</label>
                  <input name="contact_name" placeholder="Mike Johnson" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Phone</label>
                    <input name="phone" type="tel" placeholder="(555) 123-4567" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label>
                    <input name="email" type="email" placeholder="mike@abc.com" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Trade *</label>
                    <select name="trade" required className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20">
                      <option value="">Select trade…</option>
                      {TRADES.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Rating</label>
                    <select name="rating" defaultValue="3" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20">
                      {[1,2,3,4,5].map((r) => <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Insurance Expiry</label>
                    <input name="insurance_expiry" type="date" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">License #</label>
                    <input name="license_number" placeholder="LIC-12345" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
                  <textarea name="notes" rows={2} placeholder="Any additional notes..." className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="secondary" fullWidth onClick={() => setShowAddForm(false)}>Cancel</Button>
                  <Button type="submit" fullWidth disabled={saving}>{saving ? 'Adding…' : 'Add Subcontractor'}</Button>
                </div>
              </form>
            )}

            {tab === 'suppliers' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!companyId) return
                  const fd = new FormData(e.currentTarget)
                  const name = (fd.get('name') as string).trim()
                  if (!name) return
                  setSaving(true)
                  const payload = {
                    company_id: companyId,
                    name,
                    category: (fd.get('category') as string) || null,
                    primary_contact_name: (fd.get('primary_contact_name') as string).trim() || null,
                    phone: (fd.get('phone') as string).trim() || null,
                    email: (fd.get('email') as string).trim() || null,
                    website: (fd.get('website') as string).trim() || null,
                    account_number: (fd.get('account_number') as string).trim() || null,
                    address: (fd.get('address') as string).trim() || null,
                    notes: (fd.get('notes') as string).trim() || null,
                    preferred: fd.get('preferred') === 'on',
                    is_active: true,
                  }
                  const { error: mutErr } = editingSupplier
                    ? await supabase.from('suppliers').update(payload).eq('id', editingSupplier.id)
                    : await supabase.from('suppliers').insert(payload)
                  setSaving(false)
                  if (mutErr) {
                    alert('Error saving supplier: ' + mutErr.message)
                    return
                  }
                  setShowAddForm(false)
                  setEditingSupplier(null)
                  suppliersRefetch()
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Supplier Name *</label>
                  <input name="name" required defaultValue={editingSupplier?.name ?? ''} placeholder="Home Depot Pro" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Category</label>
                    <select name="category" defaultValue={editingSupplier?.category ?? ''} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20">
                      <option value="">Select…</option>
                      {SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] pb-2">
                      <input type="checkbox" name="preferred" defaultChecked={editingSupplier?.preferred ?? false} className="rounded border-[var(--border)]" />
                      Preferred supplier
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Primary Contact</label>
                  <input name="primary_contact_name" defaultValue={editingSupplier?.primary_contact_name ?? ''} placeholder="Jane Smith" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Phone</label>
                    <input name="phone" type="tel" defaultValue={editingSupplier?.phone ?? ''} placeholder="(555) 123-4567" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label>
                    <input name="email" type="email" defaultValue={editingSupplier?.email ?? ''} placeholder="sales@supplier.com" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Website</label>
                    <input name="website" type="url" defaultValue={editingSupplier?.website ?? ''} placeholder="https://…" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Our Account #</label>
                    <input name="account_number" defaultValue={editingSupplier?.account_number ?? ''} placeholder="ACC-00123" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Address</label>
                  <input name="address" defaultValue={editingSupplier?.address ?? ''} placeholder="Street, city, state" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
                  <textarea name="notes" rows={2} defaultValue={editingSupplier?.notes ?? ''} placeholder="Contractor discount, rep name, etc." className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="secondary" fullWidth onClick={() => { setShowAddForm(false); setEditingSupplier(null) }}>Cancel</Button>
                  <Button type="submit" fullWidth disabled={saving || !companyId}>{saving ? 'Saving…' : editingSupplier ? 'Save Supplier' : 'Add Supplier'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAddContactFor(null)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-[var(--navy)]">Add Contact</h2>
              <button onClick={() => setShowAddContactFor(null)} className="p-1 text-[var(--text-tertiary)]"><X size={18} /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const full_name = (fd.get('full_name') as string).trim()
                if (!full_name) return
                setSaving(true)
                const { error: insertErr } = await supabase.from('supplier_contacts').insert({
                  supplier_id: showAddContactFor,
                  full_name,
                  title: (fd.get('title') as string).trim() || null,
                  phone: (fd.get('phone') as string).trim() || null,
                  email: (fd.get('email') as string).trim() || null,
                  is_primary: fd.get('is_primary') === 'on',
                  notes: (fd.get('notes') as string).trim() || null,
                })
                setSaving(false)
                if (insertErr) {
                  alert('Error adding contact: ' + insertErr.message)
                  return
                }
                setShowAddContactFor(null)
                contactsRefetch()
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Full Name *</label>
                <input name="full_name" required placeholder="Jane Smith" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Title</label>
                <input name="title" placeholder="Account manager" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Phone</label>
                  <input name="phone" type="tel" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label>
                  <input name="email" type="email" className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <input type="checkbox" name="is_primary" className="rounded border-[var(--border)]" />
                Primary contact
              </label>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" fullWidth onClick={() => setShowAddContactFor(null)}>Cancel</Button>
                <Button type="submit" fullWidth disabled={saving}>{saving ? 'Adding…' : 'Add Contact'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-light)]">
        <button
          onClick={() => setTab('subs')}
          className={cn(
            'flex items-center gap-1.5 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all',
            tab === 'subs'
              ? 'border-[var(--navy)] text-[var(--navy)]'
              : 'border-transparent text-[var(--text-tertiary)]'
          )}
        >
          <Building2 size={13} />
          Subcontractors
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={cn(
            'flex items-center gap-1.5 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all',
            tab === 'suppliers'
              ? 'border-[var(--navy)] text-[var(--navy)]'
              : 'border-transparent text-[var(--text-tertiary)]'
          )}
        >
          <Truck size={13} />
          Suppliers
        </button>
      </div>

      {tab === 'subs' && (
        <Card padding="none">
          {subsLoading ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading subcontractors…</div>
          ) : subs.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No subcontractors added yet.</div>
          ) : subs.map((sub: { id: string; company_name: string; contact_name: string; trade: string; rating: number; phone: string; insurance_expiry: string }) => {
            const daysLeft = insuranceDaysLeft(sub.insurance_expiry)
            const insuranceWarning = daysLeft < 90

            return (
              <div key={sub.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text)] truncate">{sub.company_name}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub.contact_name}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0 capitalize ${TRADE_COLORS[sub.trade] ?? 'bg-gray-100 text-gray-600'}`}>
                    {sub.trade}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < sub.rating ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--border)]'}
                      />
                    ))}
                  </div>

                  <a
                    href={`tel:${sub.phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-1.5 text-xs text-[var(--navy)]"
                    onClick={e => e.stopPropagation()}
                  >
                    <Phone size={11} />
                    {sub.phone}
                  </a>
                </div>

                <div className={`flex items-center gap-1.5 mt-2 ${insuranceWarning ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}`}>
                  {insuranceWarning && <AlertTriangle size={12} />}
                  <p className="text-[11px]">
                    Insurance expires {sub.insurance_expiry}
                    {insuranceWarning && ` — ${daysLeft} days`}
                  </p>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {tab === 'suppliers' && (
        <div className="space-y-3">
          {suppliersError && (
            <Card>
              <p className="text-sm text-[var(--text-secondary)] mb-2">Unable to load suppliers. Check your connection and try again.</p>
              <button onClick={() => suppliersRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
            </Card>
          )}

          <Card padding="none">
            {suppliersLoading ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">Loading suppliers…</div>
            ) : suppliers.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No suppliers added yet.</div>
            ) : (
              suppliers.map((sup) => {
                const contacts = contactsBySupplier[sup.id] ?? []
                const expanded = expandedSupplierId === sup.id
                return (
                  <div key={sup.id} className="border-b border-[var(--border-light)] last:border-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-[var(--text)] truncate">{sup.name}</p>
                            {sup.preferred && (
                              <Star size={12} className="text-[var(--warning)] fill-[var(--warning)] flex-shrink-0" aria-label="Preferred supplier" />
                            )}
                          </div>
                          {sup.primary_contact_name && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sup.primary_contact_name}</p>
                          )}
                        </div>
                        {sup.category && (
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0 ${SUPPLIER_CATEGORY_COLORS[sup.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {sup.category.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--navy)]">
                        {sup.phone && (
                          <a href={`tel:${sup.phone.replace(/\D/g, '')}`} className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Phone size={11} />{sup.phone}
                          </a>
                        )}
                        {sup.email && (
                          <a href={`mailto:${sup.email}`} className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Mail size={11} />{sup.email}
                          </a>
                        )}
                        {sup.website && (
                          <a href={sup.website} target="_blank" rel="noreferrer" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Globe size={11} />Website
                          </a>
                        )}
                      </div>

                      {sup.account_number && (
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">Account #{sup.account_number}</p>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setExpandedSupplierId(expanded ? null : sup.id)}
                          className="text-[11px] font-semibold text-[var(--navy)] flex items-center gap-1"
                        >
                          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          Contacts ({contacts.length})
                        </button>
                        <button
                          onClick={() => { setEditingSupplier(sup); setShowAddForm(true) }}
                          className="text-[11px] font-semibold text-[var(--navy)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivateSupplier(sup.id)}
                          className="text-[11px] font-semibold text-[var(--text-tertiary)]"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="bg-[var(--bg)] px-4 py-3 space-y-2 border-t border-[var(--border-light)]">
                        {contacts.length === 0 ? (
                          <p className="text-[11px] text-[var(--text-tertiary)]">No additional contacts yet.</p>
                        ) : (
                          contacts.map((c) => (
                            <div key={c.id} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--text)]">
                                  {c.full_name}
                                  {c.is_primary && <span className="ml-2 text-[10px] font-normal text-[var(--warning)]">primary</span>}
                                </p>
                                {c.title && <p className="text-[11px] text-[var(--text-secondary)]">{c.title}</p>}
                                <div className="flex gap-3 mt-0.5 text-[11px] text-[var(--navy)]">
                                  {c.phone && <a href={`tel:${c.phone.replace(/\D/g, '')}`}>{c.phone}</a>}
                                  {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                        <button
                          onClick={() => setShowAddContactFor(sup.id)}
                          className="text-[11px] font-semibold text-[var(--navy)] flex items-center gap-1 mt-2"
                        >
                          <Plus size={11} /> Add contact
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </Card>
          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Supplier account numbers and discounts are admin only and never visible to employees or clients.
          </p>
        </div>
      )}
    </div>
  )
}
