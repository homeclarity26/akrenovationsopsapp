import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Rocket,
  ArrowLeft,
  ArrowRight,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'company-onboarding-draft'
const TOTAL_STEPS = 5

const SERVICES = [
  'Kitchen Remodeling',
  'Bathroom Remodeling',
  'Basement Finishing',
  'Additions',
  'Whole Home Renovation',
  'General Contracting',
] as const

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
] as const

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern (ET)',
  'America/Chicago': 'Central (CT)',
  'America/Denver': 'Mountain (MT)',
  'America/Los_Angeles': 'Pacific (PT)',
  'America/Anchorage': 'Alaska (AKT)',
  'Pacific/Honolulu': 'Hawaii (HT)',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayHours {
  open: boolean
  start: string
  end: string
}

interface FormData {
  // Step 1 — Company Info
  companyName: string
  companyPhone: string
  companyEmail: string
  street: string
  city: string
  state: string
  zip: string
  website: string
  // Step 2 — Business Details
  services: string[]
  customService: string
  serviceArea: string
  licenseNumber: string
  insuranceInfo: string
  yearsInBusiness: string
  // Step 3 — Owner Profile
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  // Step 4 — Preferences
  communicationMethod: 'email' | 'text' | 'phone'
  timezone: string
  businessHours: Record<string, DayHours>
}

type Errors = Partial<Record<string, string>>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultBusinessHours(): Record<string, DayHours> {
  const hours: Record<string, DayHours> = {}
  for (const day of DAYS) {
    hours[day] = {
      open: day !== 'Sunday',
      start: '08:00',
      end: '17:00',
    }
  }
  return hours
}

function emptyForm(user: { full_name: string; email: string } | null): FormData {
  return {
    companyName: '',
    companyPhone: '',
    companyEmail: user?.email ?? '',
    street: '',
    city: '',
    state: '',
    zip: '',
    website: '',
    services: [],
    customService: '',
    serviceArea: '',
    licenseNumber: '',
    insuranceInfo: '',
    yearsInBusiness: '',
    ownerName: user?.full_name ?? '',
    ownerEmail: user?.email ?? '',
    ownerPhone: '',
    communicationMethod: 'email',
    timezone: 'America/New_York',
    businessHours: defaultBusinessHours(),
  }
}

function saveDraft(form: FormData, step: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step }))
  } catch { /* quota exceeded — ignore */ }
}

function loadDraft(): { form: FormData; step: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StepIcon({ stepNum, currentStep }: { stepNum: number; currentStep: number }) {
  const done = stepNum < currentStep
  const active = stepNum === currentStep
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
      style={{
        background: done ? 'var(--success)' : active ? 'var(--navy)' : 'var(--border-light)',
        color: done || active ? '#fff' : 'var(--text-tertiary)',
      }}
    >
      {done ? <CheckCircle size={16} /> : stepNum}
    </div>
  )
}

const STEP_LABELS = ['Company', 'Business', 'Profile', 'Preferences', 'Launch']

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="mb-8">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3">
        {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1 flex-1">
              <StepIcon stepNum={i + 1} currentStep={current} />
              <span
                className="text-[11px] font-medium hidden sm:block"
                style={{
                  color: i + 1 <= current ? 'var(--text)' : 'var(--text-tertiary)',
                }}
              >
                {label}
              </span>
            </div>
          ))}
      </div>
      {/* Bar */}
      <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--navy)] rounded-full transition-all duration-300"
          style={{ width: `${(current / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl mb-1"
      style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}
    >
      {children}
    </h2>
  )
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5">
      {children}
      {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
    </label>
  )
}

function ImageUpload({
  label,
  currentUrl,
  onUpload,
  uploading,
  shape = 'square',
}: {
  label: string
  currentUrl: string | null
  onUpload: (file: File) => void
  uploading: boolean
  shape?: 'square' | 'circle'
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div
          className={`w-20 h-20 ${shapeClass} border-2 border-dashed border-[var(--border)] flex items-center justify-center overflow-hidden bg-[var(--bg)]`}
        >
          {currentUrl ? (
            <img src={currentUrl} alt={label} className={`w-full h-full object-cover ${shapeClass}`} />
          ) : (
            <Camera size={24} className="text-[var(--text-tertiary)]" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            JPG, PNG or WebP. Max 5 MB.
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Company Info
// ---------------------------------------------------------------------------

function StepCompanyInfo({
  form,
  errors,
  onChange,
  logoUrl,
  onLogoUpload,
  uploading,
}: {
  form: FormData
  errors: Errors
  onChange: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  logoUrl: string | null
  onLogoUpload: (file: File) => void
  uploading: boolean
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Company Info</SectionTitle>
      <SectionSubtitle>Tell us about your company so we can set up your account.</SectionSubtitle>

      <Input
        label="Company Name"
        value={form.companyName}
        onChange={(e) => onChange('companyName', e.target.value)}
        placeholder="Acme Renovations LLC"
        error={errors.companyName}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Company Phone"
          type="tel"
          value={form.companyPhone}
          onChange={(e) => onChange('companyPhone', e.target.value)}
          placeholder="(555) 123-4567"
          error={errors.companyPhone}
        />
        <Input
          label="Company Email"
          type="email"
          value={form.companyEmail}
          onChange={(e) => onChange('companyEmail', e.target.value)}
          placeholder="info@yourcompany.com"
          error={errors.companyEmail}
        />
      </div>

      <Input
        label="Street Address"
        value={form.street}
        onChange={(e) => onChange('street', e.target.value)}
        placeholder="123 Main St"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Input
          label="City"
          value={form.city}
          onChange={(e) => onChange('city', e.target.value)}
          placeholder="Nashville"
        />
        <Input
          label="State"
          value={form.state}
          onChange={(e) => onChange('state', e.target.value)}
          placeholder="TN"
        />
        <Input
          label="ZIP"
          value={form.zip}
          onChange={(e) => onChange('zip', e.target.value)}
          placeholder="37201"
        />
      </div>

      <Input
        label="Website"
        type="url"
        value={form.website}
        onChange={(e) => onChange('website', e.target.value)}
        placeholder="https://yourcompany.com"
        hint="Optional"
      />

      <ImageUpload
        label="Company Logo"
        currentUrl={logoUrl}
        onUpload={onLogoUpload}
        uploading={uploading}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Business Details
// ---------------------------------------------------------------------------

function StepBusinessDetails({
  form,
  errors,
  onChange,
}: {
  form: FormData
  errors: Errors
  onChange: <K extends keyof FormData>(k: K, v: FormData[K]) => void
}) {
  function toggleService(s: string) {
    const next = form.services.includes(s)
      ? form.services.filter((x) => x !== s)
      : [...form.services, s]
    onChange('services', next)
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Business Details</SectionTitle>
      <SectionSubtitle>Help us understand what your company offers.</SectionSubtitle>

      <div>
        <Label>Services Offered</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {SERVICES.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors"
              style={{
                borderColor: form.services.includes(s) ? 'var(--navy)' : 'var(--border)',
                background: form.services.includes(s) ? 'var(--navy)' : 'var(--white)',
                color: form.services.includes(s) ? '#fff' : 'var(--text)',
              }}
            >
              <input
                type="checkbox"
                checked={form.services.includes(s)}
                onChange={() => toggleService(s)}
                className="sr-only"
              />
              <span className="text-sm">{s}</span>
            </label>
          ))}
        </div>
        {errors.services && (
          <p className="text-xs text-[var(--danger)] mt-1">{errors.services}</p>
        )}
      </div>

      <Input
        label="Custom Service"
        value={form.customService}
        onChange={(e) => onChange('customService', e.target.value)}
        placeholder="e.g., Deck Building"
        hint="Add any service not listed above"
      />

      <Input
        label="Service Area"
        value={form.serviceArea}
        onChange={(e) => onChange('serviceArea', e.target.value)}
        placeholder="Davidson County, Williamson County..."
        hint="Counties or cities you serve"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="License Number"
          value={form.licenseNumber}
          onChange={(e) => onChange('licenseNumber', e.target.value)}
          placeholder="Optional"
        />
        <Input
          label="Insurance Info"
          value={form.insuranceInfo}
          onChange={(e) => onChange('insuranceInfo', e.target.value)}
          placeholder="Optional"
        />
      </div>

      <Input
        label="Years in Business"
        type="number"
        value={form.yearsInBusiness}
        onChange={(e) => onChange('yearsInBusiness', e.target.value)}
        placeholder="e.g., 5"
        min="0"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Owner Profile
// ---------------------------------------------------------------------------

function StepOwnerProfile({
  form,
  errors,
  onChange,
  photoUrl,
  onPhotoUpload,
  uploading,
}: {
  form: FormData
  errors: Errors
  onChange: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  photoUrl: string | null
  onPhotoUpload: (file: File) => void
  uploading: boolean
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Owner Profile</SectionTitle>
      <SectionSubtitle>Your personal details as the company owner.</SectionSubtitle>

      <ImageUpload
        label="Profile Photo"
        currentUrl={photoUrl}
        onUpload={onPhotoUpload}
        uploading={uploading}
        shape="circle"
      />

      <Input
        label="Full Name"
        value={form.ownerName}
        onChange={(e) => onChange('ownerName', e.target.value)}
        placeholder="Your full name"
        error={errors.ownerName}
        required
      />

      <Input
        label="Email"
        type="email"
        value={form.ownerEmail}
        onChange={(e) => onChange('ownerEmail', e.target.value)}
        placeholder="you@example.com"
        error={errors.ownerEmail}
        required
      />

      <Input
        label="Phone"
        type="tel"
        value={form.ownerPhone}
        onChange={(e) => onChange('ownerPhone', e.target.value)}
        placeholder="(555) 123-4567"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Preferences
// ---------------------------------------------------------------------------

function StepPreferences({
  form,
  onChange,
}: {
  form: FormData
  onChange: <K extends keyof FormData>(k: K, v: FormData[K]) => void
}) {
  const methods = ['email', 'text', 'phone'] as const

  function setHours(day: string, patch: Partial<DayHours>) {
    const updated = {
      ...form.businessHours,
      [day]: { ...form.businessHours[day], ...patch },
    }
    onChange('businessHours', updated)
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Preferences</SectionTitle>
      <SectionSubtitle>Set your communication and scheduling preferences.</SectionSubtitle>

      {/* Communication method */}
      <div>
        <Label>Preferred Communication</Label>
        <div className="flex gap-2 mt-1">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange('communicationMethod', m)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors capitalize"
              style={{
                borderColor: form.communicationMethod === m ? 'var(--navy)' : 'var(--border)',
                background: form.communicationMethod === m ? 'var(--navy)' : 'var(--white)',
                color: form.communicationMethod === m ? '#fff' : 'var(--text)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div>
        <Label>Timezone</Label>
        <select
          value={form.timezone}
          onChange={(e) => onChange('timezone', e.target.value)}
          className="w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--navy)] transition-colors"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {TIMEZONE_LABELS[tz]}
            </option>
          ))}
        </select>
      </div>

      {/* Business hours */}
      <div>
        <Label>Business Hours</Label>
        <div className="space-y-2 mt-1">
          {DAYS.map((day) => {
            const dh = form.businessHours[day]
            return (
              <div
                key={day}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-light)] bg-white"
              >
                <label className="flex items-center gap-2 w-24 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dh.open}
                    onChange={(e) => setHours(day, { open: e.target.checked })}
                    className="accent-[var(--navy)] w-4 h-4"
                  />
                  <span className="text-sm font-medium text-[var(--text)]">
                    {day.slice(0, 3)}
                  </span>
                </label>
                {dh.open ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={dh.start}
                      onChange={(e) => setHours(day, { start: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                    />
                    <span className="text-xs text-[var(--text-tertiary)]">to</span>
                    <input
                      type="time"
                      value={dh.end}
                      onChange={(e) => setHours(day, { end: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--navy)]"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-tertiary)] italic">Closed</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5: Review & Launch
// ---------------------------------------------------------------------------

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-[var(--text-tertiary)] text-sm">{label}</span>
      <span className="text-sm font-medium text-[var(--text)] text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border-light)] rounded-xl p-4 space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function StepReview({
  form,
  logoUrl,
  photoUrl,
}: {
  form: FormData
  logoUrl: string | null
  photoUrl: string | null
}) {
  const allServices = [
    ...form.services,
    ...(form.customService.trim() ? [form.customService.trim()] : []),
  ]

  const openDays = DAYS.filter((d) => form.businessHours[d]?.open)

  return (
    <div className="space-y-4">
      <SectionTitle>Review & Launch</SectionTitle>
      <SectionSubtitle>Everything look good? Hit launch to get started.</SectionSubtitle>

      <ReviewSection title="Company Info">
        {logoUrl && (
          <div className="flex justify-center mb-3">
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover" />
          </div>
        )}
        <ReviewRow label="Name" value={form.companyName} />
        <ReviewRow label="Phone" value={form.companyPhone} />
        <ReviewRow label="Email" value={form.companyEmail} />
        <ReviewRow
          label="Address"
          value={
            [form.street, form.city, form.state, form.zip]
              .filter(Boolean)
              .join(', ') || null
          }
        />
        <ReviewRow label="Website" value={form.website} />
      </ReviewSection>

      <ReviewSection title="Business Details">
        <ReviewRow label="Services" value={allServices.join(', ') || 'None selected'} />
        <ReviewRow label="Service Area" value={form.serviceArea} />
        <ReviewRow label="License #" value={form.licenseNumber} />
        <ReviewRow label="Insurance" value={form.insuranceInfo} />
        <ReviewRow label="Years in Business" value={form.yearsInBusiness} />
      </ReviewSection>

      <ReviewSection title="Owner">
        {photoUrl && (
          <div className="flex justify-center mb-3">
            <img src={photoUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
          </div>
        )}
        <ReviewRow label="Name" value={form.ownerName} />
        <ReviewRow label="Email" value={form.ownerEmail} />
        <ReviewRow label="Phone" value={form.ownerPhone} />
      </ReviewSection>

      <ReviewSection title="Preferences">
        <ReviewRow label="Communication" value={form.communicationMethod} />
        <ReviewRow label="Timezone" value={TIMEZONE_LABELS[form.timezone] ?? form.timezone} />
        <ReviewRow
          label="Open Days"
          value={openDays.map((d) => d.slice(0, 3)).join(', ')}
        />
      </ReviewSection>
    </div>
  )
}

// ===========================================================================
// Main Wizard
// ===========================================================================

export function CompanyOnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Form state — restore from localStorage if available
  const [form, setForm] = useState<FormData>(() => {
    const draft = loadDraft()
    if (draft) return draft.form
    return emptyForm(user)
  })
  const [step, setStep] = useState(() => {
    const draft = loadDraft()
    return draft?.step ?? 1
  })

  const [errors, setErrors] = useState<Errors>({})
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Pre-fill owner info from user context when it becomes available
  useEffect(() => {
    if (user && !form.ownerName && !form.ownerEmail) {
      setForm((f) => ({
        ...f,
        ownerName: f.ownerName || user.full_name,
        ownerEmail: f.ownerEmail || user.email,
        companyEmail: f.companyEmail || user.email,
      }))
    }
  }, [user])

  // Persist draft on every change
  useEffect(() => {
    saveDraft(form, step)
  }, [form, step])

  // ---- generic field setter ----
  function onChange<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  // ---- file upload helper ----
  async function uploadImage(file: File, folder: string): Promise<string | null> {
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5 MB.')
      return null
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${folder}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path)
      return urlData.publicUrl
    } catch (err: any) {
      console.error('Upload failed:', err)
      alert('Upload failed. Please try again.')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoUpload(file: File) {
    const url = await uploadImage(file, 'logos')
    if (url) setLogoUrl(url)
  }

  async function handlePhotoUpload(file: File) {
    const url = await uploadImage(file, 'photos')
    if (url) setPhotoUrl(url)
  }

  // ---- validation per step ----
  function validateStep(s: number): boolean {
    const errs: Errors = {}

    if (s === 1) {
      if (!form.companyName.trim()) errs.companyName = 'Company name is required'
    }

    if (s === 3) {
      if (!form.ownerName.trim()) errs.ownerName = 'Name is required'
      if (!form.ownerEmail.trim()) errs.ownerEmail = 'Email is required'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ---- navigation ----
  function goBack() {
    if (step === 1) {
      navigate('/admin')
    } else {
      setStep((s) => s - 1)
      window.scrollTo(0, 0)
    }
  }

  function goNext() {
    if (!validateStep(step)) return
    if (step === TOTAL_STEPS) {
      handleSubmit()
      return
    }
    setStep((s) => s + 1)
    window.scrollTo(0, 0)
  }

  // ---- final submit ----
  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const allServices = [
        ...form.services,
        ...(form.customService.trim() ? [form.customService.trim()] : []),
      ]

      // Upsert the company record
      // First check if user already has a company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single()

      const companyPayload = {
        name: form.companyName.trim(),
        phone: form.companyPhone.trim() || null,
        email: form.companyEmail.trim() || null,
        street: form.street.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        website: form.website.trim() || null,
        logo_url: logoUrl,
        services_offered: allServices,
        service_area: form.serviceArea.trim() || null,
        license_number: form.licenseNumber.trim() || null,
        insurance_info: form.insuranceInfo.trim() || null,
        years_in_business: form.yearsInBusiness ? parseInt(form.yearsInBusiness, 10) : null,
        preferred_communication: form.communicationMethod,
        business_hours: form.businessHours,
        timezone: form.timezone,
        onboarding_complete: true,
        owner_name: form.ownerName.trim(),
        updated_at: new Date().toISOString(),
      }

      let companyId = profile?.company_id

      if (companyId) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update(companyPayload)
          .eq('id', companyId)
        if (error) throw error
      } else {
        // Create new company
        const { data: newCompany, error } = await supabase
          .from('companies')
          .insert(companyPayload)
          .select('id')
          .single()
        if (error) throw error
        companyId = newCompany.id

        // Link profile to company
        await supabase
          .from('profiles')
          .update({ company_id: companyId })
          .eq('id', user!.id)
      }

      // Update the owner's profile
      await supabase
        .from('profiles')
        .update({
          full_name: form.ownerName.trim(),
          email: form.ownerEmail.trim(),
          phone: form.ownerPhone.trim() || null,
          photo_url: photoUrl,
          company_onboarding_complete: true,
        })
        .eq('id', user!.id)

      // Clear the draft and navigate to dashboard
      clearDraft()
      navigate('/admin', { replace: true })
    } catch (err: any) {
      console.error('Onboarding submit failed:', err)
      setSubmitError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- render ----
  return (
    <div className="min-h-svh flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="px-5 pt-6 pb-4"
        style={{
          background: 'linear-gradient(160deg, #1B2B4D 0%, #0f1a30 60%, #1a1a2e 100%)',
        }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2.5 mb-4">
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
              Company Setup
            </span>
          </div>
          <h1
            className="text-white leading-tight mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 7vw, 40px)',
              fontWeight: 400,
            }}
          >
            Welcome aboard
          </h1>
          <p className="text-white/50 text-sm" style={{ fontFamily: 'var(--font-body)' }}>
            Let's get your company set up on the platform.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-6 pb-32 max-w-lg mx-auto w-full">
        <ProgressBar current={step} />

        {step === 1 && (
          <StepCompanyInfo
            form={form}
            errors={errors}
            onChange={onChange}
            logoUrl={logoUrl}
            onLogoUpload={handleLogoUpload}
            uploading={uploading}
          />
        )}
        {step === 2 && (
          <StepBusinessDetails form={form} errors={errors} onChange={onChange} />
        )}
        {step === 3 && (
          <StepOwnerProfile
            form={form}
            errors={errors}
            onChange={onChange}
            photoUrl={photoUrl}
            onPhotoUpload={handlePhotoUpload}
            uploading={uploading}
          />
        )}
        {step === 4 && (
          <StepPreferences form={form} onChange={onChange} />
        )}
        {step === 5 && (
          <StepReview form={form} logoUrl={logoUrl} photoUrl={photoUrl} />
        )}

        {submitError && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl text-xs mt-4"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border-light)] p-4 z-10">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button variant="secondary" onClick={goBack} className="flex-1 min-h-[44px]">
            <ArrowLeft size={16} />
            {step === 1 ? 'Skip' : 'Back'}
          </Button>
          <Button
            variant="primary"
            onClick={goNext}
            disabled={submitting || uploading}
            className="flex-1 min-h-[44px]"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Launching...
              </>
            ) : step === TOTAL_STEPS ? (
              <>
                <Rocket size={16} />
                Launch My Dashboard
              </>
            ) : (
              <>
                Next
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
