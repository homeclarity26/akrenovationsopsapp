import { useState } from 'react'
import { Plus, Phone, Star, AlertTriangle, Building2, Truck } from 'lucide-react'
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

export function SubcontractorsPage() {
  const [tab, setTab] = useState<'subs' | 'suppliers'>('subs')

  const { data: subs = [], isLoading: subsLoading } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      const { data } = await supabase.from('subcontractors').select('*').order('company_name')
      return data ?? []
    },
  })

  // Suppliers not yet in DB — show empty state for suppliers tab
  const suppliers: never[] = []

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto lg:max-w-none lg:px-8 lg:py-6">
      <PageHeader
        title="Trade Partners"
        subtitle={`${subs.length} subs · ${suppliers.length} suppliers`}
        action={
          <Button size="sm">
            <Plus size={15} />
            {tab === 'subs' ? 'Add Sub' : 'Add Supplier'}
          </Button>
        }
      />

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
