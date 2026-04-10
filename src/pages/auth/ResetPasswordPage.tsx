import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs font-medium text-[var(--rust)] mb-1">TradeOffice AI</p>
          <h1 className="font-display text-2xl text-[var(--navy)]">Reset password</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Enter your new password below.</p>
        </div>

        {success ? (
          <div className="flex items-start gap-2 p-4 rounded-xl text-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>Password updated! Redirecting to login…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--navy)' }}
            >
              {busy ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
