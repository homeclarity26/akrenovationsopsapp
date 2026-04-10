import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (err) {
        setError(err.message)
        return
      }
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] mb-4">
            <ArrowLeft size={14} /> Back to login
          </Link>
          <p className="text-xs font-medium text-[var(--rust)] mb-1">TradeOffice AI</p>
          <h1 className="font-display text-2xl text-[var(--navy)]">Forgot password</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Enter your email and we'll send a reset link.</p>
        </div>

        {sent ? (
          <div className="flex items-start gap-2 p-4 rounded-xl text-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>Check your email for a password reset link.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
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
              {busy ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
