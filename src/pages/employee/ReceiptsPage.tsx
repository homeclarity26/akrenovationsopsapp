import { useState } from 'react'
import { Camera, Check, Clock, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type ReceiptStatus = 'pending' | 'submitted'

interface ScanState {
  step: 'idle' | 'scanning' | 'review'
  vendor: string
  amount: string
  date: string
  project: string
  items: string[]
}

interface ReceiptRow {
  id: string
  vendor: string | null
  amount: number
  date: string
  project?: string
  project_id: string | null
  status: ReceiptStatus
  projects?: { title: string } | null
}

export function ReceiptsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: receipts = [] } = useQuery({
    queryKey: ['receipts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('expenses')
        .select('id, vendor, amount, date, project_id, receipt_image_url, projects(title)')
        .eq('entered_by', user!.id)
        .not('receipt_image_url', 'is', null)
        .order('date', { ascending: false })
      return (data ?? []).map((r: any) => ({
        id: r.id,
        vendor: r.vendor ?? 'Unknown',
        amount: r.amount,
        date: r.date,
        project: r.projects?.title ?? 'No Project',
        project_id: r.project_id,
        status: 'submitted' as ReceiptStatus,
      })) as ReceiptRow[]
    },
  })

  const [localReceipts, setLocalReceipts] = useState<ReceiptRow[]>([])
  const [scan, setScan] = useState<ScanState>({
    step: 'idle',
    vendor: '',
    amount: '',
    date: '',
    project: '',
    items: [],
  })

  const startScan = () => {
    // Simulate AI extraction after "taking photo"
    setScan({ step: 'scanning', vendor: '', amount: '', date: '', project: '', items: [] })
    setTimeout(() => {
      setScan({
        step: 'review',
        vendor: 'Home Depot',
        amount: '143.87',
        date: new Date().toLocaleDateString(),
        project: 'Johnson Bath',
        items: ['Grout sealer', 'Painter\'s tape', 'Sponges (3-pack)'],
      })
    }, 1800)
  }

  const submitReceipt = () => {
    setLocalReceipts(prev => [{
      id: `rec-${Date.now()}`,
      vendor: scan.vendor,
      amount: parseFloat(scan.amount),
      date: scan.date,
      project: scan.project,
      project_id: null,
      status: 'submitted' as ReceiptStatus,
    }, ...prev])
    setScan({ step: 'idle', vendor: '', amount: '', date: '', project: '', items: [] })
    queryClient.invalidateQueries({ queryKey: ['receipts', user?.id] })
  }

  if (scan.step === 'scanning') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="w-20 h-20 rounded-full bg-[var(--navy)] flex items-center justify-center mb-6 animate-pulse">
          <Camera size={32} className="text-white" />
        </div>
        <p className="font-semibold text-[var(--text)] text-lg mb-2">Reading Receipt...</p>
        <p className="text-sm text-[var(--text-secondary)]">AI is extracting the details</p>
      </div>
    )
  }

  if (scan.step === 'review') {
    return (
      <div className="p-4 space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl text-[var(--navy)]">Review Receipt</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Confirm the extracted details</p>
        </div>

        <Card>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Vendor</label>
              <input
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                value={scan.vendor}
                onChange={e => setScan(s => ({ ...s, vendor: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Amount</label>
                <input
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                  value={scan.amount}
                  onChange={e => setScan(s => ({ ...s, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Date</label>
                <input
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                  value={scan.date}
                  onChange={e => setScan(s => ({ ...s, date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Project</label>
              <select
                className="w-full mt-1 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                value={scan.project}
                onChange={e => setScan(s => ({ ...s, project: e.target.value }))}
              >
                <option>Johnson Bath</option>
                <option>Thompson Addition</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] block mb-2">Items</label>
              <div className="space-y-1">
                {scan.items.map((item, i) => (
                  <p key={i} className="text-sm text-[var(--text)] py-1.5 px-3 bg-[var(--bg)] rounded-lg">{item}</p>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <button
            onClick={submitReceipt}
            className="w-full py-4 rounded-xl font-semibold text-sm text-white bg-[var(--navy)] flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Submit Receipt
          </button>
          <button
            onClick={() => setScan({ step: 'idle', vendor: '', amount: '', date: '', project: '', items: [] })}
            className="w-full py-3 rounded-xl font-medium text-sm text-[var(--text-secondary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl text-[var(--navy)]">Receipts</h1>
      </div>

      {/* Scan button */}
      <button
        onClick={startScan}
        className="w-full py-5 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors active:bg-[var(--cream-light)]"
        style={{ borderColor: 'var(--border)', background: 'var(--white)' }}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--navy)] flex items-center justify-center">
          <Camera size={22} className="text-white" />
        </div>
        <p className="font-semibold text-sm text-[var(--text)]">Scan a Receipt</p>
        <p className="text-xs text-[var(--text-tertiary)]">AI extracts vendor, amount, and items</p>
      </button>

      {/* History */}
      <div>
        <SectionHeader title="Recent Receipts" />
        {[...localReceipts, ...receipts].length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No receipts submitted yet.</p>
          </Card>
        ) : (
          <Card padding="none">
            {[...localReceipts, ...receipts].map(r => (
              <div key={r.id} className="flex items-center gap-3 p-4 border-b border-[var(--border-light)] last:border-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0">
                  {r.status === 'submitted'
                    ? <Check size={16} className="text-[var(--success)]" />
                    : <Clock size={16} className="text-[var(--warning)]" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text)]">{r.vendor}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{r.project} · {r.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-semibold text-[var(--text)]">${r.amount.toFixed(2)}</p>
                  <p className={`text-[11px] capitalize ${r.status === 'submitted' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                    {r.status}
                  </p>
                </div>
                <ChevronRight size={15} className="text-[var(--text-tertiary)] flex-shrink-0" />
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
