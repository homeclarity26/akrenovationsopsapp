// PasswordChangePage — PR #19
// Shown to employees on first login when must_change_password = true.
// Forces them to set a new password before accessing the app.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

interface Props {
  onComplete: () => void
}

export function PasswordChangePage({ onComplete }: Props) {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setBusy(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw new Error(updateErr.message)
      if (user) {
        await supabase.from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id)
      }
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(27,43,77,0.96)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        <ShieldCheck size={36} className="text-white" />
      </div>

      <h2 className="font-display text-3xl text-white text-center mb-2">Set your password</h2>
      <p className="text-white/60 text-center text-sm mb-8 max-w-xs">
        Your account was created with a temporary password. Choose a new one to get started.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <PasswordInput
          label="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          hint="At least 6 characters."
          required
        />
        <PasswordInput
          label="Confirm password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: 'var(--rust)', color: '#fff' }}
        >
          {busy ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : 'Set Password & Continue'}
        </button>
      </form>
    </div>
  )
}
