import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'

const INVOICES = [
  { id: 'i1', number: 'INV-2026-037', title: 'Deposit – 30%', total: 14550, paid: 14550, status: 'paid' as const, date: 'Mar 1' },
  { id: 'i2', number: 'INV-2026-041', title: 'Milestone 2 – Tile & Fixtures', total: 16200, paid: 0, status: 'sent' as const, date: 'Apr 5', due: 'Apr 20' },
  { id: 'i3', number: 'INV-2026-TBD', title: 'Final Payment', total: 17750, paid: 0, status: 'pending' as const, date: 'Est. May 10' },
]

export function ClientInvoices() {
  const totalPaid = INVOICES.reduce((s, i) => s + i.paid, 0)
  const totalContract = 48500

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="font-display text-2xl text-[var(--navy)]">Invoices</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-4">
          <p className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] mb-1">Paid to Date</p>
          <p className="font-display text-2xl text-[var(--success)]">${totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-4">
          <p className="text-[10px] uppercase font-semibold tracking-wide text-[var(--text-tertiary)] mb-1">Remaining</p>
          <p className="font-display text-2xl text-[var(--text)]">${(totalContract - totalPaid).toLocaleString()}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-[var(--border-light)] p-4">
        <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-2">
          <span>Payment Progress</span>
          <span>${totalPaid.toLocaleString()} of ${totalContract.toLocaleString()}</span>
        </div>
        <div className="h-2.5 bg-[var(--border-light)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--success)] rounded-full"
            style={{ width: `${(totalPaid / totalContract) * 100}%` }}
          />
        </div>
      </div>

      {/* Invoices list */}
      <div>
        <SectionHeader title="All Invoices" />
        <div className="space-y-3">
          {INVOICES.map(inv => (
            <Card key={inv.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{inv.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{inv.number}</p>
                </div>
                <StatusPill status={inv.status} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-semibold text-lg text-[var(--text)]">${inv.total.toLocaleString()}</p>
                  {inv.due && <p className="text-xs text-[var(--warning)]">Due {inv.due}</p>}
                  {!inv.due && <p className="text-xs text-[var(--text-tertiary)]">{inv.date}</p>}
                </div>
                {inv.status === 'sent' && (
                  <Button size="sm">
                    Pay Now
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
