// AddEmployeeModal — PR #19
// Admin fills out employee profile → system creates account + sends welcome email.

import { useState } from 'react'
import { X, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/Input'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export function AddEmployeeModal({ onClose, onSuccess }: Props) {
  const { user, session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role_title: 'employee' as 'employee' | 'admin',
    pay_type: 'hourly' as 'hourly' | 'salary',
    pay_rate: '',
    start_date: '',
    emergency_contact: '',
    phone: '',
    notes: '',
  })

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }

    setBusy(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          type: 'employee',
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          role_title: form.role_title,
          pay_type: form.pay_type,
          pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : undefined,
          start_date: form.start_date || undefined,
          emergency_contact: form.emergency_contact || undefined,
          phone: form.phone || undefined,
          notes: form.notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to create employee')

      setDone(true)
      setTimeout(() => { onSuccess(); onClose() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-[var(--white)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border-light)]">
          <h2 className="font-semibold text-[var(--text)] text-lg">Add Employee</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)]">
            <X size={18} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--success-bg)' }}>
              <CheckCircle2 size={28} className="text-[var(--success)]" />
            </div>
            <p className="font-semibold text-[var(--text)]">Account created</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Welcome email sent to {form.email}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Full name *" type="text" value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" required />
              </div>
              <div className="col-span-2">
                <Input label="Email address *" type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Role</label>
                <select value={form.role_title} onChange={set('role_title')} className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--white)] text-[var(--text)]">
                  <option value="employee">Field Worker</option>
                  <option value="admin">Admin / Foreman</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Pay type</label>
                <select value={form.pay_type} onChange={set('pay_type')} className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--white)] text-[var(--text)]">
                  <option value="hourly">Hourly</option>
                  <option value="salary">Salary</option>
                </select>
              </div>
              <div>
                <Input
                  label={form.pay_type === 'hourly' ? '$/hr' : 'Annual salary'}
                  type="number"
                  value={form.pay_rate}
                  onChange={set('pay_rate')}
                  placeholder={form.pay_type === 'hourly' ? '25.00' : '55000'}
                />
              </div>
              <div>
                <Input label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
              </div>
              <div className="col-span-2">
                <Input label="Phone number" type="tel" value={form.phone} onChange={set('phone')} placeholder="(330) 555-0100" />
              </div>
              <div className="col-span-2">
                <Input label="Emergency contact (name + phone)" type="text" value={form.emergency_contact} onChange={set('emergency_contact')} placeholder="John Smith — (330) 555-0199" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={set('notes')}
                  rows={2}
                  placeholder="Any additional notes…"
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--white)] text-[var(--text)] resize-none focus:outline-none focus:border-[var(--navy)]"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-xs text-[var(--text-tertiary)]">
              A welcome email with login credentials and "save to phone" instructions will be sent automatically.
            </p>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'var(--navy)' }}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : 'Create & Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
