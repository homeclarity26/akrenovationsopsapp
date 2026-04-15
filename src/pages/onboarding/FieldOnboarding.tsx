import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HardHat, ArrowRight, ArrowLeft, CheckCircle, Clock, Camera, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const STEPS = [
  {
    title: 'Welcome to Field Mode',
    subtitle: 'Your mobile-first command center for the job site.',
    icon: HardHat,
    content: [
      'Field mode is designed for the way you actually work — on your feet, on the site.',
      'Log time, take photos, check your schedule, and communicate with the office — all from your phone.',
      'Everything you capture here automatically syncs to the admin dashboard.',
    ],
  },
  {
    title: 'Your Daily Workflow',
    subtitle: 'Here\'s how a typical day looks in field mode.',
    icon: Clock,
    content: [
      'Check your schedule — See today\'s assignments, job site addresses, and notes.',
      'Clock in/out — Tap to start and stop your work timer. GPS verifies you\'re on site.',
      'Daily log — Quick note at end of day: what got done, any issues, tomorrow\'s plan.',
      'Photo log — Snap progress photos that auto-tag to the right project and phase.',
    ],
  },
  {
    title: 'Photos & Documentation',
    subtitle: 'Visual records keep everyone on the same page.',
    icon: Camera,
    content: [
      'Take photos right from the app — they auto-upload and organize by project.',
      'Photos appear in the client portal, so homeowners see progress in real time.',
      'Snap receipts for materials — they flow into the expense tracker automatically.',
      'Before/after comparisons are built from your photo log.',
    ],
  },
  {
    title: 'AI Assistant & Communication',
    subtitle: 'Get help and stay connected from the field.',
    icon: MessageSquare,
    content: [
      'The AI assistant can answer questions about the project scope, materials, or schedule.',
      'Send messages to the office that get threaded into the project conversation.',
      'Request tool deliveries, flag issues, or submit shopping list updates.',
      'Voice notes are supported — speak instead of type when your hands are busy.',
    ],
  },
]

export function FieldOnboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [completing, setCompleting] = useState(false)

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = currentStep.icon

  const handleComplete = async () => {
    if (!user) return
    setCompleting(true)
    try {
      await supabase
        .from('profiles')
        .update({ field_onboarding_complete: true })
        .eq('id', user.id)
      await refreshProfile()

      // Route based on role
      if (user.role === 'employee') {
        navigate('/employee')
      } else {
        navigate('/admin')
      }
    } catch {
      if (user.role === 'employee') {
        navigate('/employee')
      } else {
        navigate('/admin')
      }
    }
  }

  return (
    <div
      className="min-h-svh flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--rust)] flex items-center justify-center">
              <HardHat size={20} className="text-white" />
            </div>
            <div>
              <p className="font-display text-lg text-[var(--navy)]">Field Mode Setup</p>
              <p className="text-xs text-[var(--text-tertiary)]">Step {step + 1} of {STEPS.length}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--rust)] rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center pt-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--rust)] flex items-center justify-center mx-auto mb-4">
              <Icon size={28} className="text-white" />
            </div>
            <h1 className="font-display text-2xl text-[var(--navy)] mb-2">{currentStep.title}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{currentStep.subtitle}</p>
          </div>

          <Card>
            <div className="space-y-3">
              {currentStep.content.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <CheckCircle size={16} className="text-[var(--success)] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[var(--text)] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 pt-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft size={16} />
              Back
            </Button>
          )}
          <Button
            fullWidth
            variant={isLast ? 'primary' : 'primary'}
            onClick={isLast ? handleComplete : () => setStep(s => s + 1)}
            disabled={completing}
          >
            {completing ? (
              <><Loader2 size={16} className="animate-spin" /> Completing...</>
            ) : isLast ? (
              <><CheckCircle size={16} /> Start Working</>
            ) : (
              <>Continue <ArrowRight size={16} /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
