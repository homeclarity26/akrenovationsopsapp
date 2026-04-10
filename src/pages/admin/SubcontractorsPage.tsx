import { useState } from 'react'
import { Plus, Phone, Star, AlertTriangle, Building2, Truck, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const TRADE_COLORS: Record<string, string> = {
  electrical:  'bg-yellow-100 text-yellow-700',
  concrete:    'bg-stone-100 text-stone-700',
  plumbing:    'bg-blue-100 text-blue-700',
  hvac:        'bg-cyan-100 text-cyan-700',
  roofing:     'bg-orange-100 text-orange-700',
  framing:     'bg-green-100 text-green-700',
}


function insuranceDaysLeft(expiry: string) {
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  return days
}

const TRADES = ['electrical', 'concrete', 'plumbing', 'hvac', 'roofing', 'framing', 'painting', 'drywall', 'flooring', 'landscaping']

export function SubcontractorsPage() {
  const [tab, setTab] = useState<'subs' | 'suppliers'>('subs')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: subs = [], isLoading: subsLoading, error: subsError, refetch: subsRefetch } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      const { data } = await supabase.from('subcontractors').select('*').order('company_name')
      return data ?? []
    },
  })

  // Suppliers not yet in DB — show empty state for suppliers tab
  const suppliers: never[] = []

  if (subsError) return (
    <div className="p-8 text-center">
      <p className="text-sm text-[var(--text-secondary)] mb-3">Unable to load trade partners. Check your connection and try again.</p>
      <button onClick={() => subsRefetch()} className="text-xs font-semibold text-[var(--navy)] border border-[var(--navy)] px-3 py-2 rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Trade Partners"
        subtitle={`${subs.length} subs · ${suppliers.length} suppliers`}
        action={
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus size={15} />
            {tab === 'subs' ? 'Add Sub' : 'Add Supplier'}
          </Button>
        }
      />

      {/* Add Subcontractor Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAddForm(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-[var(--navy)]">{tab === 'subs' ? 'Add Subcontractor' : 'Add Supplier'}</h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 text-[var(--text-tertiary)]"><X size={18} /></button>
            </div>
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
                <Button type="submit" fullWidth disabled={saving}>{saving ? 'Adding…' : tab === 'subs' ? 'Add Subcontractor' : 'Add Supplier'}</Button>
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
          <Card padding="none">
            <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">No suppliers added yet.</div>
          </Card>
          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Supplier account numbers and discounts are admin only and never visible to employees or clients.
          </p>
        </div>
      )}
    </div>
  )
}
