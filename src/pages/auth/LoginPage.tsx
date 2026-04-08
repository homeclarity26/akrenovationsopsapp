import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { MOCK_USERS } from '@/data/mock'
import { Input } from '@/components/ui/Input'
import { Shield, HardHat, Home, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createAppSession } from '@/lib/session'
import { auditLoginFailed } from '@/lib/audit'

const ROLE_OPTIONS = [
  {
    id: 'admin-1',
    role: 'admin',
    label: 'Admin',
    name: 'Adam Kilgore',
    description: 'Full access to CRM, financials, projects, and AI command center',
    icon: Shield,
    accent: 'var(--navy)',
    tag: 'Owner',
  },
  {
    id: 'employee-1',
    role: 'employee',
    label: 'Field',
    name: 'Jeff Miller',
    description: 'Time clock, shopping list, receipts, photos, schedule',
    icon: HardHat,
    accent: 'var(--rust)',
    tag: 'Employee',
  },
  {
    id: 'client-1',
    role: 'client',
    label: 'Client',
    name: 'Johnson Residence',
    description: 'Project progress, photos, invoices, selections, messages',
    icon: Home,
    accent: 'var(--success)',
    tag: 'Homeowner',
  },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'role' | 'credentials'>('role')

  const selectedUser = MOCK_USERS.find(u => u.id === selected)
  const selectedOpt = ROLE_OPTIONS.find(o => o.id === selected)

  const handleRoleSelect = (id: string) => {
    setSelected(id)
    setStep('credentials')
    const user = MOCK_USERS.find(u => u.id === id)
    if (user) setEmail(user.email)
  }

  const handleLogin = async () => {
    if (!selected) {
      await auditLoginFailed(email || 'unknown')
      return
    }
    const user = MOCK_USERS.find(u => u.id === selected)
    if (!user) {
      await auditLoginFailed(email || 'unknown')
      return
    }
    login(selected)
    // Record the application-level session (best effort — swallows errors)
    await createAppSession(user.id, user.role)
    if (user.role === 'admin') navigate('/admin')
    else if (user.role === 'employee') navigate('/employee')
    else navigate('/client/progress')
  }

  return (
    <div className="min-h-svh flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Hero — full bleed, tall */}
      <div
        className="relative flex flex-col justify-end overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1B2B4D 0%, #0f1a30 60%, #1a1a2e 100%)',
          minHeight: '42vh',
          paddingBottom: '48px',
        }}
      >
        {/* Decorative grid lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(var(--cream) 1px, transparent 1px), linear-gradient(90deg, var(--cream) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Cream accent bar */}
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ background: 'var(--rust)', opacity: 0.8 }}
        />

        {/* Content */}
        <div className="relative px-8 max-w-md">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5 mb-8">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--rust)' }}
            >
              <span className="text-white font-bold text-xs tracking-wide">AK</span>
            </div>
            <span className="text-white/70 text-sm font-medium tracking-wide uppercase" style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.12em' }}>
              AK Renovations
            </span>
          </div>

          <p className="text-white/40 text-sm mb-2" style={{ fontFamily: 'var(--font-body)' }}>
            Operations Platform
          </p>
          <h1
            className="text-white leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(52px, 12vw, 72px)', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            AK Ops
          </h1>
        </div>
      </div>

      {/* Card panel */}
      <div className="flex-1 px-5 pt-8 pb-10 max-w-md mx-auto w-full">

        {step === 'role' ? (
          <>
            <div className="mb-6">
              <p
                className="text-xs font-semibold tracking-widest uppercase mb-1"
                style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em' }}
              >
                Sign in as
              </p>
              <div className="w-8 h-px" style={{ background: 'var(--rust)' }} />
            </div>

            <div className="space-y-3">
              {ROLE_OPTIONS.map(opt => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleRoleSelect(opt.id)}
                    className={cn(
                      'w-full text-left rounded-2xl border transition-all duration-150',
                      'active:scale-[0.985]',
                    )}
                    style={{
                      background: 'var(--white)',
                      borderColor: 'var(--border-light)',
                      padding: '18px 20px',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = opt.accent
                      e.currentTarget.style.boxShadow = `0 0 0 1px ${opt.accent}22, 0 4px 16px -4px ${opt.accent}30`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-light)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${opt.accent}18` }}
                      >
                        <Icon size={20} style={{ color: opt.accent }} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="font-semibold text-sm"
                            style={{ color: 'var(--text)', fontFamily: 'var(--font-body)' }}
                          >
                            {opt.label}
                          </span>
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{
                              background: `${opt.accent}14`,
                              color: opt.accent,
                              letterSpacing: '0.06em',
                            }}
                          >
                            {opt.tag}
                          </span>
                        </div>
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
                        >
                          {opt.description}
                        </p>
                      </div>

                      <ArrowRight size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    </div>
                  </button>
                )
              })}
            </div>

            <p
              className="text-center text-xs mt-8"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Demo mode — mock data only
            </p>
          </>
        ) : (
          <>
            {/* Back */}
            <button
              onClick={() => setStep('role')}
              className="flex items-center gap-1.5 text-sm mb-8 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <ArrowLeft size={15} />
              Back
            </button>

            {/* User badge */}
            {selectedUser && selectedOpt && (
              <div className="flex items-center gap-3 mb-8 pb-8 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${selectedOpt.accent}18` }}
                >
                  <selectedOpt.icon size={22} style={{ color: selectedOpt.accent }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{selectedUser.full_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{selectedOpt.tag}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                hint="Any password works in demo mode."
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full mt-5 py-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--navy)', fontFamily: 'var(--font-body)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--navy-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--navy)'}
            >
              Sign In
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
