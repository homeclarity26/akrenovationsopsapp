// Real Supabase-backed login / signup page.
// Replaces the previous mock role-picker demo.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/Input'
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createAppSession } from '@/lib/session'
import { auditLoginFailed } from '@/lib/audit'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // If already authenticated, bounce to the right place
  useEffect(() => {
    if (loading) return
    if (!user) return
    if (user.role === 'admin') navigate('/admin', { replace: true })
    else if (user.role === 'employee') navigate('/employee', { replace: true })
    else navigate('/client/progress', { replace: true })
  }, [user, loading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email.trim(), password)
        if (err) {
          setError(err)
          await auditLoginFailed(email.trim())
          return
        }
        // Session will come through via the auth state change listener —
        // createAppSession is fire-and-forget for the app-level record.
        // We can't read user.id here because the context hasn't updated yet;
        // createAppSession is called from the useEffect above if needed.
        setSuccess('Signed in. Redirecting…')
      } else {
        const { error: err } = await signUp(email.trim(), password, fullName.trim() || undefined)
        if (err) {
          setError(err)
          return
        }
        setSuccess("Account created. Signing you in…")
        // Auto-sign-in after signup (email confirmation is disabled at the
        // project level, so signUp returns an active session immediately).
        await signIn(email.trim(), password)
      }
    } finally {
      setBusy(false)
    }
  }

  // Log app-level session record once the real user object lands
  useEffect(() => {
    if (user && !loading) {
      createAppSession(user.id, user.role).catch(() => {})
    }
  }, [user, loading])

  return (
    <div className="min-h-svh flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <div
        className="relative flex flex-col justify-end overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1B2B4D 0%, #0f1a30 60%, #1a1a2e 100%)',
          minHeight: '36vh',
          paddingBottom: '40px',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--cream) 1px, transparent 1px), linear-gradient(90deg, var(--cream) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ background: 'var(--rust)', opacity: 0.8 }}
        />
        <div className="relative px-8 max-w-md">
          <div className="flex items-center gap-2.5 mb-8">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--rust)' }}
            >
              <span className="text-white font-bold text-xs tracking-wide">AK</span>
            </div>
            <span
              className="text-white/70 text-sm font-medium tracking-wide uppercase"
              style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.12em' }}
            >
              AK Renovations
            </span>
          </div>
          <p
            className="text-white/40 text-sm mb-2"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Operations Platform
          </p>
          <h1
            className="text-white leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(48px, 11vw, 64px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
            }}
          >
            AK Ops
          </h1>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">
        {/* Mode toggle */}
        <div
          className="flex p-1 rounded-xl mb-6"
          style={{ background: 'var(--bg)', border: '1px solid var(--border-light)' }}
        >
          <button
            onClick={() => {
              setMode('signin')
              setError(null)
              setSuccess(null)
            }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: mode === 'signin' ? 'var(--white)' : 'transparent',
              color: mode === 'signin' ? 'var(--text)' : 'var(--text-tertiary)',
              boxShadow:
                mode === 'signin'
                  ? '0 1px 2px rgba(27,43,77,0.06), 0 0 0 1px rgba(27,43,77,0.04)'
                  : 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setMode('signup')
              setError(null)
              setSuccess(null)
            }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: mode === 'signup' ? 'var(--white)' : 'transparent',
              color: mode === 'signup' ? 'var(--text)' : 'var(--text-tertiary)',
              boxShadow:
                mode === 'signup'
                  ? '0 1px 2px rgba(27,43,77,0.06), 0 0 0 1px rgba(27,43,77,0.04)'
                  : 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            Create account
          </button>
        </div>

        <div className="mb-5">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-1"
            style={{
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.1em',
            }}
          >
            {mode === 'signin' ? 'Welcome back' : 'Get started'}
          </p>
          <div className="w-8 h-px" style={{ background: 'var(--rust)' }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Input
              label="Full name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adam Kilgore"
              autoComplete="name"
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
            required
          />

          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
              }}
            >
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{
                background: 'var(--success-bg)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'var(--navy)', fontFamily: 'var(--font-body)' }}
            onMouseEnter={(e) => {
              if (!busy) e.currentTarget.style.background = 'var(--navy-light)'
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--navy)')}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              <>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {mode === 'signin' && (
          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-tertiary)' }}>
            <a href="/forgot-password" className="underline" style={{ color: 'var(--rust)' }}>
              Forgot password?
            </a>
          </p>
        )}

        <p
          className="text-center text-xs mt-4"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {mode === 'signin' ? (
            <>
              Don't have an account yet?{' '}
              <button
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
                className="underline"
                style={{ color: 'var(--rust)' }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
                className="underline"
                style={{ color: 'var(--rust)' }}
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p
          className="text-center text-[10px] mt-8"
          style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
        >
          Or try the{' '}
          <a href="/demo/employee" style={{ color: 'var(--rust)' }}>
            employee demo
          </a>{' '}
          ·{' '}
          <a href="/experience" style={{ color: 'var(--rust)' }}>
            homeowner demo
          </a>
        </p>
      </div>
    </div>
  )
}
