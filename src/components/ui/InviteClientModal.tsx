// InviteClientModal — PR #19
// Admin enters client name + email → system sends invite link to project portal.

import { useState } from 'react'
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/Input'

interface Props {
  projectId: string
  projectName: string
  onClose: () => void
}

export function InviteClientModal({ projectId, projectName, onClose }: Props) {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !email.trim()) { setError('Name and email are required.'); return }

    setBusy(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          type: 'client',
          email: email.trim(),
          full_name: name.trim(),
          project_id: projectId,
          project_name: projectName,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed to send invite')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-[var(--white)] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border-light)]">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Invite Client</h2>
            <p className="text-xs text-[var(--text-tertiary)]">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)]">
            <X size={18} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--success-bg)' }}>
              <CheckCircle2 size={28} className="text-[var(--success)]" />
            </div>
            <p className="font-semibold text-[var(--text)]">Invite sent</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{email} will receive a link to access their portal.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--navy)' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Your client will receive an email with a secure link to create their account and access this project's portal.
            </p>
            <Input label="Client name *" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Sarah Johnson" required />
            <Input label="Email address *" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@example.com" required />

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

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
                {busy ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
