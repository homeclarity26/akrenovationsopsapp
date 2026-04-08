import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  HardHat,
  Wrench,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  Star,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardType = 'client' | 'employee' | 'subcontractor'

interface Project {
  id: string
  title: string
  status: string
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function inputCls(hasError?: boolean) {
  return [
    'w-full rounded-2xl border bg-[var(--bg)] px-4 py-3 text-[14px] text-[var(--text)]',
    'focus:outline-none focus:border-[var(--navy)] transition-colors',
    hasError
      ? 'border-[var(--danger)]'
      : 'border-[var(--border)]',
  ].join(' ')
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-[var(--danger)] mt-1">{msg}</p>
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5">
      {children}
      {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
          Step {current} of {total}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={[
                'rounded-full transition-all',
                i + 1 < current
                  ? 'w-2 h-2 bg-[var(--success)]'
                  : i + 1 === current
                  ? 'w-3 h-3 bg-[var(--rust)]'
                  : 'w-2 h-2 bg-[var(--border)]',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
      <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--navy)] rounded-full transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sticky bottom nav for wizard
// ---------------------------------------------------------------------------

function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Next',
  loading = false,
  backLabel = 'Back',
}: {
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  loading?: boolean
  backLabel?: string
}) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-[var(--border-light)] p-4 flex gap-3 mt-6">
      <Button variant="secondary" onClick={onBack} className="flex-1 min-h-[44px]">
        <ArrowLeft size={16} />
        {backLabel}
      </Button>
      <Button
        variant="primary"
        onClick={onNext}
        disabled={loading}
        className="flex-1 min-h-[44px]"
      >
        {loading ? 'Saving...' : nextLabel}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------

function SuccessScreen({
  summary,
  viewPath,
  viewLabel,
  onAddAnother,
}: {
  summary: React.ReactNode
  viewPath: string
  viewLabel: string
  onAddAnother: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 space-y-4">
      <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
        <CheckCircle size={36} className="text-[var(--success)]" />
      </div>
      <h2 className="font-display text-2xl text-[var(--navy)]">Done!</h2>
      <div className="w-full max-w-sm">{summary}</div>
      <div className="flex flex-col gap-3 w-full max-w-sm pt-2">
        <Button variant="primary" fullWidth onClick={() => navigate(viewPath)} className="min-h-[44px]">
          {viewLabel}
        </Button>
        <Button variant="secondary" fullWidth onClick={onAddAnother} className="min-h-[44px]">
          Add Another
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Star rating component
// ---------------------------------------------------------------------------

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Star
            size={24}
            className={n <= value ? 'text-[var(--rust)] fill-[var(--rust)]' : 'text-[var(--border)]'}
          />
        </button>
      ))}
    </div>
  )
}

// ===========================================================================
// FLOW 1: New Client
// ===========================================================================

interface ClientForm {
  fullName: string
  phone: string
  email: string
  notes: string
  projectMode: 'link' | 'new'
  linkedProjectId: string
  newProjectType: string
  newProjectAddress: string
  newProjectContractValue: string
  createPortal: boolean
}

function ClientWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const totalSteps = 3
  const [form, setForm] = useState<ClientForm>({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
    projectMode: 'link',
    linkedProjectId: '',
    newProjectType: 'kitchen',
    newProjectAddress: '',
    newProjectContractValue: '',
    createPortal: true,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ClientForm, string>>>({})
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [successData, setSuccessData] = useState<{ profileId: string } | null>(null)

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, title, status')
      .in('status', ['pending', 'active'])
      .order('title')
      .then(({ data }) => setProjects((data as Project[]) ?? []))
  }, [])

  function set<K extends keyof ClientForm>(k: K, v: ClientForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function validateStep1() {
    const errs: typeof errors = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required'
    if (!form.phone.trim()) errs.phone = 'Phone is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2() {
    const errs: typeof errors = {}
    if (form.projectMode === 'link' && !form.linkedProjectId) {
      errs.linkedProjectId = 'Please select a project'
    }
    if (form.projectMode === 'new' && !form.newProjectAddress.trim()) {
      errs.newProjectAddress = 'Address is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    setLoading(true)
    try {
      // Insert profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .insert({
          role: 'client',
          full_name: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        })
        .select('id')
        .single()

      if (profileErr) throw profileErr

      // Create new project if needed
      if (form.projectMode === 'new') {
        await supabase.from('projects').insert({
          title: `${form.fullName.trim()} - ${form.newProjectType}`,
          project_type: form.newProjectType,
          client_name: form.fullName.trim(),
          client_email: form.email.trim() || null,
          client_phone: form.phone.trim() || null,
          client_user_id: profile.id,
          address: form.newProjectAddress.trim(),
          contract_value: form.newProjectContractValue
            ? parseFloat(form.newProjectContractValue)
            : 0,
          status: 'pending',
        })
      } else if (form.projectMode === 'link' && form.linkedProjectId) {
        await supabase
          .from('projects')
          .update({
            client_user_id: profile.id,
            client_name: form.fullName.trim(),
            client_email: form.email.trim() || null,
            client_phone: form.phone.trim() || null,
          })
          .eq('id', form.linkedProjectId)
      }

      setSuccessData({ profileId: profile.id })
      setStep(4)
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    if (step === 1) onDone()
    else setStep((s) => s - 1)
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    if (step === 3) {
      handleCreate()
      return
    }
    setStep((s) => s + 1)
  }

  if (step === 4 && successData) {
    const linkedProject = projects.find((p) => p.id === form.linkedProjectId)
    return (
      <SuccessScreen
        viewPath="/admin/crm"
        viewLabel="View in CRM"
        onAddAnother={onDone}
        summary={
          <Card>
            <div className="space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Name</span>
                <span className="font-semibold text-[var(--text)]">{form.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Phone</span>
                <span className="text-[var(--text)]">{form.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Email</span>
                <span className="text-[var(--text)]">{form.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Project</span>
                <span className="text-[var(--text)]">
                  {form.projectMode === 'new'
                    ? `New ${form.newProjectType}`
                    : linkedProject?.title ?? 'Linked'}
                </span>
              </div>
              {form.createPortal && (
                <div className="pt-2 border-t border-[var(--border-light)]">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Send them this link to set up their password:
                  </p>
                  <p className="text-xs font-mono text-[var(--navy)] mt-0.5 break-all">
                    {window.location.origin}/login
                  </p>
                </div>
              )}
            </div>
          </Card>
        }
      />
    )
  }

  return (
    <div className="space-y-1">
      <ProgressBar current={step} total={totalSteps} />

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Contact Info</h2>
          <div>
            <Label required>Full Name</Label>
            <input
              className={inputCls(!!errors.fullName)}
              placeholder="Jane Smith"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            <FieldError msg={errors.fullName} />
          </div>
          <div>
            <Label required>Phone</Label>
            <input
              className={inputCls(!!errors.phone)}
              type="tel"
              placeholder="(330) 555-0100"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <FieldError msg={errors.phone} />
          </div>
          <div>
            <Label required>Email</Label>
            <input
              className={inputCls(!!errors.email)}
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <FieldError msg={errors.email} />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              className={inputCls() + ' resize-none'}
              rows={3}
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Project</h2>
          <div className="flex gap-3">
            {(['link', 'new'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => set('projectMode', mode)}
                className={[
                  'flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors min-h-[44px]',
                  form.projectMode === mode
                    ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                    : 'bg-white text-[var(--text)] border-[var(--border)]',
                ].join(' ')}
              >
                {mode === 'link' ? 'Link to existing' : 'Create new'}
              </button>
            ))}
          </div>

          {form.projectMode === 'link' && (
            <div>
              <Label required>Select Project</Label>
              <select
                className={inputCls(!!errors.linkedProjectId)}
                value={form.linkedProjectId}
                onChange={(e) => set('linkedProjectId', e.target.value)}
              >
                <option value="">Choose a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.linkedProjectId} />
            </div>
          )}

          {form.projectMode === 'new' && (
            <>
              <div>
                <Label required>Project Type</Label>
                <select
                  className={inputCls()}
                  value={form.newProjectType}
                  onChange={(e) => set('newProjectType', e.target.value)}
                >
                  {['kitchen', 'bathroom', 'addition', 'basement', 'first_floor', 'other'].map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label required>Address</Label>
                <input
                  className={inputCls(!!errors.newProjectAddress)}
                  placeholder="123 Main St, Akron, OH"
                  value={form.newProjectAddress}
                  onChange={(e) => set('newProjectAddress', e.target.value)}
                />
                <FieldError msg={errors.newProjectAddress} />
              </div>
              <div>
                <Label>Contract Value</Label>
                <input
                  className={inputCls()}
                  type="number"
                  placeholder="0"
                  min="0"
                  value={form.newProjectContractValue}
                  onChange={(e) => set('newProjectContractValue', e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Portal Access</h2>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">
              Summary
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Name</span>
                <span className="font-semibold text-[var(--text)]">{form.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Phone</span>
                <span className="text-[var(--text)]">{form.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Email</span>
                <span className="text-[var(--text)]">{form.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Project</span>
                <span className="text-[var(--text)]">
                  {form.projectMode === 'new'
                    ? `New ${form.newProjectType} — ${form.newProjectAddress}`
                    : projects.find((p) => p.id === form.linkedProjectId)?.title ?? 'None'}
                </span>
              </div>
            </div>
          </Card>

          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={form.createPortal}
              onChange={(e) => set('createPortal', e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[var(--navy)]"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Create portal login</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                After saving, send the client a link to set their own password.
              </p>
            </div>
          </label>
        </div>
      )}

      <WizardNav
        onBack={handleBack}
        onNext={handleNext}
        backLabel={step === 1 ? 'Cancel' : 'Back'}
        nextLabel={step === totalSteps ? 'Create Client' : 'Next'}
        loading={loading}
      />
    </div>
  )
}

// ===========================================================================
// FLOW 2: New Employee
// ===========================================================================

interface EmployeeForm {
  fullName: string
  phone: string
  email: string
  startDate: string
  payType: 'salary' | 'hourly'
  annualSalary: string
  hourlyRate: string
  vehicleAllowance: string
}

function EmployeeWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const totalSteps = 3
  const [form, setForm] = useState<EmployeeForm>({
    fullName: '',
    phone: '',
    email: '',
    startDate: '',
    payType: 'hourly',
    annualSalary: '',
    hourlyRate: '',
    vehicleAllowance: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeForm, string>>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function set<K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function validateStep1() {
    const errs: typeof errors = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    setLoading(true)
    try {
      await supabase.from('profiles').insert({
        role: 'employee',
        full_name: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        start_date: form.startDate || null,
        hourly_rate:
          form.payType === 'hourly' && form.hourlyRate
            ? parseFloat(form.hourlyRate)
            : null,
        base_salary:
          form.payType === 'salary' && form.annualSalary
            ? parseFloat(form.annualSalary)
            : null,
      })
      setDone(true)
      setStep(4)
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    if (step === 1) onDone()
    else setStep((s) => s - 1)
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 3) {
      handleCreate()
      return
    }
    setStep((s) => s + 1)
  }

  if (step === 4 && done) {
    return (
      <SuccessScreen
        viewPath="/admin/payroll/workers"
        viewLabel="View in Payroll"
        onAddAnother={onDone}
        summary={
          <Card>
            <div className="space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Name</span>
                <span className="font-semibold text-[var(--text)]">{form.fullName}</span>
              </div>
              {form.phone && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Phone</span>
                  <span className="text-[var(--text)]">{form.phone}</span>
                </div>
              )}
              {form.email && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Email</span>
                  <span className="text-[var(--text)]">{form.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Pay</span>
                <span className="text-[var(--text)]">
                  {form.payType === 'hourly'
                    ? `$${form.hourlyRate}/hr`
                    : `$${Number(form.annualSalary).toLocaleString()}/yr`}
                </span>
              </div>
              {form.startDate && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Start Date</span>
                  <span className="text-[var(--text)]">{form.startDate}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[var(--border-light)]">
                <p className="text-xs text-[var(--text-secondary)]">
                  Go to Payroll &gt; Workers to complete full compensation setup.
                </p>
              </div>
            </div>
          </Card>
        }
      />
    )
  }

  return (
    <div className="space-y-1">
      <ProgressBar current={step} total={totalSteps} />

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Basic Info</h2>
          <div>
            <Label required>Full Name</Label>
            <input
              className={inputCls(!!errors.fullName)}
              placeholder="Jeff Miller"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            <FieldError msg={errors.fullName} />
          </div>
          <div>
            <Label>Phone</Label>
            <input
              className={inputCls()}
              type="tel"
              placeholder="(330) 555-0101"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <input
              className={inputCls()}
              type="email"
              placeholder="jeff@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div>
            <Label>Start Date</Label>
            <input
              className={inputCls()}
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Pay Setup</h2>
          <div>
            <Label>Pay Type</Label>
            <div className="flex gap-3">
              {(['hourly', 'salary'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('payType', t)}
                  className={[
                    'flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] capitalize',
                    form.payType === t
                      ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                      : 'bg-white text-[var(--text)] border-[var(--border)]',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {form.payType === 'hourly' && (
            <div>
              <Label>Hourly Rate ($)</Label>
              <input
                className={inputCls()}
                type="number"
                placeholder="22.00"
                min="0"
                step="0.50"
                value={form.hourlyRate}
                onChange={(e) => set('hourlyRate', e.target.value)}
              />
            </div>
          )}

          {form.payType === 'salary' && (
            <div>
              <Label>Annual Salary ($)</Label>
              <input
                className={inputCls()}
                type="number"
                placeholder="52000"
                min="0"
                value={form.annualSalary}
                onChange={(e) => set('annualSalary', e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>Vehicle Allowance ($/month)</Label>
            <input
              className={inputCls()}
              type="number"
              placeholder="0"
              min="0"
              value={form.vehicleAllowance}
              onChange={(e) => set('vehicleAllowance', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Review</h2>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">
              Summary
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Name</span>
                <span className="font-semibold text-[var(--text)]">{form.fullName}</span>
              </div>
              {form.phone && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Phone</span>
                  <span className="text-[var(--text)]">{form.phone}</span>
                </div>
              )}
              {form.email && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Email</span>
                  <span className="text-[var(--text)]">{form.email}</span>
                </div>
              )}
              {form.startDate && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Start Date</span>
                  <span className="text-[var(--text)]">{form.startDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Pay Type</span>
                <span className="text-[var(--text)] capitalize">{form.payType}</span>
              </div>
              {form.payType === 'hourly' && form.hourlyRate && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Hourly Rate</span>
                  <span className="text-[var(--text)]">${form.hourlyRate}/hr</span>
                </div>
              )}
              {form.payType === 'salary' && form.annualSalary && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Annual Salary</span>
                  <span className="text-[var(--text)]">
                    ${Number(form.annualSalary).toLocaleString()}/yr
                  </span>
                </div>
              )}
              {form.vehicleAllowance && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Vehicle Allowance</span>
                  <span className="text-[var(--text)]">${form.vehicleAllowance}/mo</span>
                </div>
              )}
            </div>
          </Card>
          <p className="text-xs text-[var(--text-secondary)] bg-[var(--cream-light)] rounded-xl p-3">
            After saving, go to Payroll &gt; Workers to complete full compensation setup.
          </p>
        </div>
      )}

      <WizardNav
        onBack={handleBack}
        onNext={handleNext}
        backLabel={step === 1 ? 'Cancel' : 'Back'}
        nextLabel={step === totalSteps ? 'Create Employee' : 'Next'}
        loading={loading}
      />
    </div>
  )
}

// ===========================================================================
// FLOW 3: New Subcontractor
// ===========================================================================

interface SubForm {
  companyName: string
  contactName: string
  phone: string
  email: string
  trade: string
  licenseNumber: string
  insuranceExpiry: string
  rating: number
  notes: string
}

const TRADES = [
  'plumbing', 'electrical', 'hvac', 'framing', 'roofing',
  'concrete', 'tile', 'painting', 'drywall', 'flooring', 'landscaping', 'other',
]

function SubcontractorWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const totalSteps = 3
  const [form, setForm] = useState<SubForm>({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    trade: 'plumbing',
    licenseNumber: '',
    insuranceExpiry: '',
    rating: 0,
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SubForm, string>>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function set<K extends keyof SubForm>(k: K, v: SubForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function validateStep1() {
    const errs: typeof errors = {}
    if (!form.companyName.trim()) errs.companyName = 'Company name is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2() {
    const errs: typeof errors = {}
    if (!form.trade) errs.trade = 'Trade is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    setLoading(true)
    try {
      await supabase.from('subcontractors').insert({
        company_name: form.companyName.trim(),
        contact_name: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        trade: form.trade,
        license_number: form.licenseNumber.trim() || null,
        insurance_expiry: form.insuranceExpiry || null,
        rating: form.rating || null,
        notes: form.notes.trim() || null,
        is_active: true,
      })
      setDone(true)
      setStep(4)
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    if (step === 1) onDone()
    else setStep((s) => s - 1)
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    if (step === 3) {
      handleCreate()
      return
    }
    setStep((s) => s + 1)
  }

  if (step === 4 && done) {
    return (
      <SuccessScreen
        viewPath="/admin/subs"
        viewLabel="View Subcontractors"
        onAddAnother={onDone}
        summary={
          <Card>
            <div className="space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Company</span>
                <span className="font-semibold text-[var(--text)]">{form.companyName}</span>
              </div>
              {form.contactName && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Contact</span>
                  <span className="text-[var(--text)]">{form.contactName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Trade</span>
                <span className="text-[var(--text)] capitalize">{form.trade}</span>
              </div>
              {form.insuranceExpiry && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Insurance Exp.</span>
                  <span className="text-[var(--text)]">{form.insuranceExpiry}</span>
                </div>
              )}
              {form.rating > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)]">Rating</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          i < form.rating
                            ? 'text-[var(--rust)] fill-[var(--rust)]'
                            : 'text-[var(--border)]'
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        }
      />
    )
  }

  return (
    <div className="space-y-1">
      <ProgressBar current={step} total={totalSteps} />

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Contact Info</h2>
          <div>
            <Label required>Company Name</Label>
            <input
              className={inputCls(!!errors.companyName)}
              placeholder="Buckeye Plumbing Co."
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
            />
            <FieldError msg={errors.companyName} />
          </div>
          <div>
            <Label>Contact Name</Label>
            <input
              className={inputCls()}
              placeholder="Mike Johnson"
              value={form.contactName}
              onChange={(e) => set('contactName', e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <input
              className={inputCls()}
              type="tel"
              placeholder="(330) 555-0200"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <input
              className={inputCls()}
              type="email"
              placeholder="mike@buckeye.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Trade Info</h2>
          <div>
            <Label required>Trade</Label>
            <select
              className={inputCls(!!errors.trade)}
              value={form.trade}
              onChange={(e) => set('trade', e.target.value)}
            >
              {TRADES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <FieldError msg={errors.trade} />
          </div>
          <div>
            <Label>License Number</Label>
            <input
              className={inputCls()}
              placeholder="OH-PLB-12345"
              value={form.licenseNumber}
              onChange={(e) => set('licenseNumber', e.target.value)}
            />
          </div>
          <div>
            <Label>Insurance Expiry Date</Label>
            <input
              className={inputCls()}
              type="date"
              value={form.insuranceExpiry}
              onChange={(e) => set('insuranceExpiry', e.target.value)}
            />
          </div>
          <div>
            <Label>Rating</Label>
            <StarRating value={form.rating} onChange={(v) => set('rating', v)} />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              className={inputCls() + ' resize-none'}
              rows={3}
              placeholder="Any notes on this sub..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-[var(--navy)]">Review</h2>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">
              Summary
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Company</span>
                <span className="font-semibold text-[var(--text)]">{form.companyName}</span>
              </div>
              {form.contactName && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Contact</span>
                  <span className="text-[var(--text)]">{form.contactName}</span>
                </div>
              )}
              {form.phone && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Phone</span>
                  <span className="text-[var(--text)]">{form.phone}</span>
                </div>
              )}
              {form.email && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Email</span>
                  <span className="text-[var(--text)]">{form.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Trade</span>
                <span className="text-[var(--text)] capitalize">{form.trade}</span>
              </div>
              {form.licenseNumber && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">License</span>
                  <span className="text-[var(--text)]">{form.licenseNumber}</span>
                </div>
              )}
              {form.insuranceExpiry && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Insurance Exp.</span>
                  <span className="text-[var(--text)]">{form.insuranceExpiry}</span>
                </div>
              )}
              {form.rating > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)]">Rating</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          i < form.rating
                            ? 'text-[var(--rust)] fill-[var(--rust)]'
                            : 'text-[var(--border)]'
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <WizardNav
        onBack={handleBack}
        onNext={handleNext}
        backLabel={step === 1 ? 'Cancel' : 'Back'}
        nextLabel={step === totalSteps ? 'Add Subcontractor' : 'Next'}
        loading={loading}
      />
    </div>
  )
}

// ===========================================================================
// Type Selector
// ===========================================================================

const ONBOARD_TYPES: {
  type: OnboardType
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  subtitle: string
}[] = [
  {
    type: 'client',
    icon: User,
    label: 'New Client',
    subtitle: 'Create a client account and link their project',
  },
  {
    type: 'employee',
    icon: HardHat,
    label: 'New Employee',
    subtitle: 'Set up a new crew member with pay and portal access',
  },
  {
    type: 'subcontractor',
    icon: Wrench,
    label: 'New Subcontractor',
    subtitle: 'Add a sub to your directory with trade and insurance info',
  },
]

function TypeSelector({ onSelect }: { onSelect: (t: OnboardType) => void }) {
  return (
    <div className="space-y-3 pt-2">
      {ONBOARD_TYPES.map(({ type, icon: Icon, label, subtitle }) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className="w-full text-left bg-white rounded-xl border border-[var(--border-light)] p-4 flex items-center gap-4 min-h-[72px] hover:border-[var(--navy)] hover:bg-[var(--bg)] transition-colors group"
        >
          <div className="w-11 h-11 rounded-xl bg-[var(--cream-light)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--navy)] transition-colors">
            <Icon size={20} className="text-[var(--navy)] group-hover:text-white transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--text)] text-sm">{label}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          </div>
          <ChevronRight size={18} className="text-[var(--text-tertiary)] flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ===========================================================================
// Main Page
// ===========================================================================

export function OnboardingPage() {
  const [activeType, setActiveType] = useState<OnboardType | null>(null)

  function handleDone() {
    setActiveType(null)
  }

  const selectedMeta = ONBOARD_TYPES.find((t) => t.type === activeType)

  return (
    <div className="p-4 pb-32 max-w-lg mx-auto lg:px-8 lg:py-6">
      {activeType && (
        <button
          onClick={handleDone}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors mb-4 min-h-[44px]"
        >
          <ArrowLeft size={15} />
          Onboarding
        </button>
      )}

      <PageHeader
        title={activeType ? selectedMeta?.label ?? 'Onboarding' : 'Onboarding'}
        subtitle={
          activeType
            ? undefined
            : 'Add a client, employee, or subcontractor to AK Ops'
        }
      />

      <div className="mt-5">
        {activeType === null && <TypeSelector onSelect={setActiveType} />}
        {activeType === 'client' && <ClientWizard onDone={handleDone} />}
        {activeType === 'employee' && <EmployeeWizard onDone={handleDone} />}
        {activeType === 'subcontractor' && <SubcontractorWizard onDone={handleDone} />}
      </div>
    </div>
  )
}
