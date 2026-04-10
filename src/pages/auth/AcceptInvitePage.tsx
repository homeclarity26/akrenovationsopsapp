// AcceptInvitePage — PR #19
// Handles the client invite token flow: /invite/:token
// Looks up the invitation, lets the client set their password,
// creates their account, then drops them into their project portal.

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

interface Invitation {
  id: string
  email: string
  full_name: string
  project_id: string | null
  role: string
  status: string
  expires_at: string
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase
      .from('invitations')
      .select('id, email, full_name, project_id, role, status, expires_at')
      .eq('token', token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('This invitation link is invalid or has expired.')
        } else if (data.status === 'accepted') {
          setError('This invitation has already been accepted. Please sign in.')
        } else if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired. Please ask your contractor to send a new one.')
        } else {
          setInvite(data)
        }
        setLoading(false)
      })
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invite) return
    setError(null)
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setBusy(true)
    try {
      // Sign up the client
      const { error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { data: { full_name: invite.full_name } },
      })
      if (signUpErr) throw new Error(signUpErr.message)

      // Sign in immediately
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      })
      if (signInErr) throw new Error(signInErr.message)

      // Mark invitation accepted
      await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('token', token)

      setDone(true)
      setTimeout(() => navigate('/client/progress', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin text-[var(--navy)]" />
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col" style={{ background: 'var(--bg)' }}>
      <div
        className="flex flex-col justify-end px-8 pb-10"
        style={{
          background: 'linear-gradient(160deg, #1B2B4D 0%, #0f1a30 60%, #1a1a2e 100%)',
          minHeight: '32vh',
        }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--rust)' }}>
            <span className="text-white font-bold text-xs">T</span>
          </div>
          <span className="text-white/70 text-sm font-medium tracking-wide uppercase">TradeOffice AI</span>
        </div>
        <h1 className="font-display text-4xl text-white mb-2">Your Project Portal</h1>
        <p className="text-white/60 text-sm">
          {invite ? `Welcome, ${invite.full_name}. Set your password to access your portal.` : 'Access your project portal'}
        </p>
      </div>

      <div className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">
        {error && !done && (
          <div className="flex items-start gap-2 p-4 rounded-xl mb-6 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {error.includes('sign in') && (
                <button onClick={() => navigate('/login')} className="underline mt-1 text-xs">Go to login →</button>
              )}
            </div>
          </div>
        )}

        {done && (
          <div className="flex items-start gap-2 p-4 rounded-xl mb-6 text-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            <span>Account created! Taking you to your project…</span>
          </div>
        )}

        {invite && !done && (
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--border-light)] bg-[var(--white)]">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">Signing up as</p>
              <p className="font-semibold text-[var(--text)]">{invite.full_name}</p>
              <p className="text-sm text-[var(--text-secondary)]">{invite.email}</p>
            </div>

            <PasswordInput
              label="Choose a password"
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
              {busy
                ? <><Loader2 size={16} className="animate-spin" /> Creating account…</>
                : <>Access My Portal <ArrowRight size={16} /></>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
