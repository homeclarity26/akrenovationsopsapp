import { useState } from 'react'
import { Plus, Phone, Star, AlertTriangle, Building2, Truck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { MOCK_SUBCONTRACTORS, MOCK_SUPPLIERS } from '@/data/mock'
import { cn } from '@/lib/utils'

const TRADE_COLORS: Record<string, string> = {
  electrical:  'bg-yellow-100 text-yellow-700',
  concrete:    'bg-stone-100 text-stone-700',
  plumbing:    'bg-blue-100 text-blue-700',
  hvac:        'bg-cyan-100 text-cyan-700',
  roofing:     'bg-orange-100 text-orange-700',
  framing:     'bg-green-100 text-green-700',
}

const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
  lumber_building: 'Lumber & Building',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  tile_flooring: 'Tile & Flooring',
  cabinets: 'Cabinets',
  countertops: 'Countertops',
  appliances: 'Appliances',
  paint: 'Paint',
  hvac: 'HVAC',
  hardware: 'Hardware',
  rental: 'Rental',
  dumpster: 'Dumpster',
  concrete: 'Concrete',
  roofing: 'Roofing',
  windows_doors: 'Windows & Doors',
  other: 'Other',
}

function insuranceDaysLeft(expiry: string) {
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  return days
}

export function SubcontractorsPage() {
  const [tab, setTab] = useState<'subs' | 'suppliers'>('subs')
  const subs = MOCK_SUBCONTRACTORS
  const suppliers = MOCK_SUPPLIERS

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
          {subs.map(sub => {
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
            {suppliers.map((s) => (
              <div key={s.id} className="p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[var(--text)] truncate">{s.company_name}</p>
                      {s.is_preferred && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide bg-[var(--rust-subtle)] text-[var(--rust)] px-1.5 py-0.5 rounded-full">
                          Preferred
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {SUPPLIER_CATEGORY_LABELS[s.category] ?? s.category}
                      {s.city && ` · ${s.city}`}
                    </p>
                  </div>
                  {s.rating && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={i < (s.rating ?? 0) ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--border)]'}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Account</p>
                    <p className="text-xs font-mono text-[var(--text)]">{s.account_number ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Discount</p>
                    <p className="text-xs font-mono text-[var(--text)]">
                      {s.contractor_discount_percent != null ? `${s.contractor_discount_percent}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Terms</p>
                    <p className="text-xs text-[var(--text)]">{s.payment_terms ?? '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-light)]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">YTD spend</p>
                    <p className="font-mono text-sm font-semibold text-[var(--text)]">${s.ytd_spend.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Annual spend</p>
                    <p className="font-mono text-sm font-semibold text-[var(--text)]">${s.annual_spend.toLocaleString()}</p>
                  </div>
                </div>

                {(s.rep_name || s.phone) && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border-light)]">
                    {s.rep_name && (
                      <p className="text-[11px] text-[var(--text-secondary)]">Rep: {s.rep_name}</p>
                    )}
                    {s.phone && (
                      <a
                        href={`tel:${s.phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-1 text-xs text-[var(--navy)]"
                      >
                        <Phone size={11} />
                        {s.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>
          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Supplier account numbers and discounts are admin only and never visible to employees or clients.
          </p>
        </div>
      )}
    </div>
  )
}
