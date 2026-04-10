import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  FileText,
  MessageCircle,
  Receipt,
  Home,
  Mail,
  Phone,
  MessageSquare,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteData {
  full_name?: string
  email?: string
  project_address?: string
  project_type?: string
  lead_id?: string
  project_id?: string
}

type ContactMethod = 'email' | 'text' | 'phone'
type TimePreference = 'morning' | 'afternoon' | 'evening' | 'anytime'

// ---------------------------------------------------------------------------
// Step progress indicator
// ---------------------------------------------------------------------------

const STEPS = ['Create Account', 'About Your Project', 'Your Portal'] as const

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-8">
      {/* Step labels */}
      <div className="flex items-center justify-between mb-3">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                i + 1 < current
                  ? 'bg-[var(--success)] text-white'
                  : i + 1 === current
                  ? 'bg-[var(--navy)] text-white'
                  : 'bg-[var(--border)] text-[var(--text-tertiary)]',
              ].join(' ')}
            >
              {i + 1 < current ? (
                <CheckCircle2 size={14} />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={[
                'text-xs font-medium hidden sm:inline',
                i + 1 === current ? 'text-[var(--text)]' : 'text-[var(--text-tertiary)]',
              ].join(' ')}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--navy)] rounded-full transition-all duration-300"
          style={{ width: `${(current / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Create Account
// ---------------------------------------------------------------------------

function StepCreateAccount({
  invite,
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  errors,
}: {
  invite: InviteData
  fullName: string
  setFullName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2
          className="text-2xl font-semibold text-[var(--text)] mb-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Welcome to AK Renovations
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Let's get your account set up so you can follow along with your project.
        </p>
      </div>

      <Input
        label="Full Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Jane Smith"
        autoComplete="name"
        error={errors.fullName}
      />

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="jane@example.com"
        autoComplete="email"
        readOnly={!!invite.email}
        error={errors.email}
        hint={invite.email ? 'Pre-filled from your invitation' : undefined}
      />

      <PasswordInput
        label="Create Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 6 characters"
        autoComplete="new-password"
        error={errors.password}
        hint="Choose something you'll remember — at least 6 characters."
      />

      <PasswordInput
        label="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        error={errors.confirmPassword}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — About Your Project
// ---------------------------------------------------------------------------

const CONTACT_METHODS: { value: ContactMethod; label: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'phone', label: 'Phone', icon: Phone },
]

const TIME_OPTIONS: { value: TimePreference; label: string }[] = [
  { value: 'morning', label: 'Morning (8am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12–5pm)' },
  { value: 'evening', label: 'Evening (5–8pm)' },
  { value: 'anytime', label: 'Anytime works' },
]

function StepAboutProject({
  invite,
  projectAddress,
  setProjectAddress,
  projectType,
  contactMethod,
  setContactMethod,
  timePreference,
  setTimePreference,
  concerns,
  setConcerns,
  errors,
}: {
  invite: InviteData
  projectAddress: string
  setProjectAddress: (v: string) => void
  projectType: string
  contactMethod: ContactMethod
  setContactMethod: (v: ContactMethod) => void
  timePreference: TimePreference
  setTimePreference: (v: TimePreference) => void
  concerns: string
  setConcerns: (v: string) => void
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2
          className="text-2xl font-semibold text-[var(--text)] mb-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          About Your Project
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Help us make sure we have the right details on file.
        </p>
      </div>

      <Input
        label="Project Address"
        value={projectAddress}
        onChange={(e) => setProjectAddress(e.target.value)}
        placeholder="123 Main St, Hudson, OH"
        autoComplete="street-address"
        error={errors.projectAddress}
        hint={invite.project_address ? 'Pre-filled from your contractor' : undefined}
      />

      {projectType && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text)]">Project Type</label>
          <div
            className="flex items-center gap-2 px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)]"
          >
            <Home size={16} className="text-[var(--text-tertiary)]" />
            <span className="text-sm text-[var(--text)] capitalize">{projectType}</span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">Set by your contractor</p>
        </div>
      )}

      {/* Preferred contact method */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--text)]">
          Preferred Contact Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CONTACT_METHODS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setContactMethod(value)}
              className={[
                'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-[1.5px] transition-all',
                contactMethod === value
                  ? 'border-[var(--navy)] bg-[var(--navy)]/5'
                  : 'border-[var(--border)] hover:border-[var(--navy-light)]',
              ].join(' ')}
            >
              <Icon
                size={20}
                className={contactMethod === value ? 'text-[var(--navy)]' : 'text-[var(--text-tertiary)]'}
              />
              <span
                className={[
                  'text-xs font-medium',
                  contactMethod === value ? 'text-[var(--navy)]' : 'text-[var(--text-secondary)]',
                ].join(' ')}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Best time to reach */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--text)]">
          Best Time to Reach You
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TIME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTimePreference(value)}
              className={[
                'py-2.5 px-3 rounded-xl border-[1.5px] text-xs font-medium transition-all text-left',
                timePreference === value
                  ? 'border-[var(--navy)] bg-[var(--navy)]/5 text-[var(--navy)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--navy-light)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions / concerns */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--text)]">
          Questions or Concerns <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
        </label>
        <textarea
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          placeholder="Anything you'd like us to know before we get started..."
          rows={3}
          className="w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--navy)] transition-colors text-sm resize-none"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Portal Tour
// ---------------------------------------------------------------------------

const TOUR_CARDS = [
  {
    icon: CalendarDays,
    title: 'View Your Project Timeline',
    description: 'See every phase of your project and track real-time progress.',
    color: 'var(--navy)',
  },
  {
    icon: FileText,
    title: 'See Proposals & Selections',
    description: 'Review proposals, approve material selections, and sign off on changes.',
    color: 'var(--rust)',
  },
  {
    icon: MessageCircle,
    title: 'Message Your Contractor',
    description: 'Send messages directly to your project team — no phone tag.',
    color: 'var(--success)',
  },
  {
    icon: Receipt,
    title: 'Track Invoices & Payments',
    description: 'View invoices, see payment history, and stay on top of your budget.',
    color: 'var(--warning)',
  },
]

function StepPortalTour() {
  return (
    <div className="space-y-5">
      <div>
        <h2
          className="text-2xl font-semibold text-[var(--text)] mb-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Your Project Portal
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Here's what you can do from your personal dashboard.
        </p>
      </div>

      <div className="space-y-3">
        {TOUR_CARDS.map(({ icon: Icon, title, description, color }) => (
          <Card key={title}>
            <div className="flex items-start gap-3.5">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${color}10` }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] mb-0.5">{title}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export function ClientOnboardingWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, signUp, signIn } = useAuth()

  // Invite data from URL params (set by invitation link)
  const [invite] = useState<InviteData>(() => ({
    full_name: searchParams.get('name') ?? undefined,
    email: searchParams.get('email') ?? undefined,
    project_address: searchParams.get('address') ?? undefined,
    project_type: searchParams.get('type') ?? undefined,
    lead_id: searchParams.get('lead') ?? undefined,
    project_id: searchParams.get('project') ?? undefined,
  }))

  // Wizard state
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 fields
  const [fullName, setFullName] = useState(invite.full_name ?? '')
  const [email, setEmail] = useState(invite.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Step 2 fields
  const [projectAddress, setProjectAddress] = useState(invite.project_address ?? '')
  const [projectType] = useState(invite.project_type ?? '')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email')
  const [timePreference, setTimePreference] = useState<TimePreference>('anytime')
  const [concerns, setConcerns] = useState('')

  // If already authenticated and already onboarded, redirect to portal
  useEffect(() => {
    if (user && step === 1) {
      // User already signed in — skip account creation, go to step 2
      setStep(2)
    }
  }, [user, step])

  // ------- Validation -------

  function validateStep1(): boolean {
    const errs: Record<string, string> = {}
    if (!fullName.trim()) errs.fullName = 'Name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = 'Enter a valid email address'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'Must be at least 6 characters'
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {}
    if (!projectAddress.trim()) errs.projectAddress = 'Project address is required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ------- Create account (Step 1 → 2) -------

  async function handleCreateAccount() {
    if (!validateStep1()) return
    setError(null)
    setBusy(true)

    try {
      // Create auth user
      const { error: signUpErr } = await signUp(email.trim(), password, fullName.trim())
      if (signUpErr) {
        setError(signUpErr)
        return
      }

      // Auto sign-in (email confirmation disabled)
      const { error: signInErr } = await signIn(email.trim(), password)
      if (signInErr) {
        setError(signInErr)
        return
      }

      setStep(2)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // ------- Save project info (Step 2 → 3) -------

  async function handleSaveProjectInfo() {
    if (!validateStep2()) return
    setError(null)
    setBusy(true)

    try {
      // Get the current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setError('Session expired. Please refresh and try again.')
        return
      }

      // Update the profile with client role and onboarding preferences
      await supabase
        .from('profiles')
        .update({
          role: 'client',
          full_name: fullName.trim(),
          onboarding_complete: true,
          preferred_contact: contactMethod,
          preferred_time: timePreference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id)

      // Link the auth user to their existing lead/project if invite data exists
      if (invite.lead_id) {
        // Update the lead with the auth user link
        await supabase
          .from('leads')
          .update({
            email: email.trim(),
            address: projectAddress.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invite.lead_id)

        // Log the onboarding activity
        await supabase.from('lead_activities').insert({
          lead_id: invite.lead_id,
          activity_type: 'note',
          description: `Client completed portal onboarding. Contact: ${contactMethod}, Time: ${timePreference}${concerns.trim() ? `. Questions: ${concerns.trim()}` : ''}`,
          created_by: authUser.id,
        })
      }

      if (invite.project_id) {
        // Link the auth user to the project
        await supabase
          .from('projects')
          .update({
            client_user_id: authUser.id,
            client_name: fullName.trim(),
            client_email: email.trim(),
            address: projectAddress.trim() || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invite.project_id)
      }

      setStep(3)
    } catch (err) {
      setError('Something went wrong saving your info. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // ------- Finish (Step 3 → Dashboard) -------

  function handleFinish() {
    navigate('/client/progress', { replace: true })
  }

  // ------- Navigation handlers -------

  function handleNext() {
    setError(null)
    if (step === 1) handleCreateAccount()
    else if (step === 2) handleSaveProjectInfo()
    else handleFinish()
  }

  function handleBack() {
    setError(null)
    setFieldErrors({})
    if (step > 1) setStep(step - 1)
  }

  // ------- Render -------

  return (
    <div
      className="min-h-svh flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="px-5 pt-6 pb-4"
        style={{
          background: 'linear-gradient(160deg, #1B2B4D 0%, #0f1a30 60%, #1a1a2e 100%)',
        }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--rust)' }}
            >
              <span className="text-white font-bold text-[10px] tracking-wide">AK</span>
            </div>
            <span
              className="text-white/70 text-xs font-medium tracking-wide uppercase"
              style={{ letterSpacing: '0.12em' }}
            >
              AK Renovations
            </span>
          </div>
          <p className="text-white/50 text-xs">Client Portal Setup</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 pt-6 pb-32 max-w-lg mx-auto w-full">
        <StepProgress current={step} />

        {step === 1 && (
          <StepCreateAccount
            invite={invite}
            fullName={fullName}
            setFullName={setFullName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            errors={fieldErrors}
          />
        )}

        {step === 2 && (
          <StepAboutProject
            invite={invite}
            projectAddress={projectAddress}
            setProjectAddress={setProjectAddress}
            projectType={projectType}
            contactMethod={contactMethod}
            setContactMethod={setContactMethod}
            timePreference={timePreference}
            setTimePreference={setTimePreference}
            concerns={concerns}
            setConcerns={setConcerns}
            errors={fieldErrors}
          />
        )}

        {step === 3 && <StepPortalTour />}

        {/* Error banner */}
        {error && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl text-xs mt-5"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Sticky bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-white/95 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          {step > 1 && (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleBack}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleNext}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {step === 1 ? 'Creating account...' : 'Saving...'}
              </>
            ) : step === 3 ? (
              <>
                Got it, take me to my portal
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
