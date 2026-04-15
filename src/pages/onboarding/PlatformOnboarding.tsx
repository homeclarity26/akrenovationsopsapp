import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, ArrowLeft, CheckCircle, Building2, Users, Activity, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const STEPS = [
  {
    title: 'Welcome to TradeOffice AI',
    subtitle: "You're the platform owner. This quick tour will get you oriented.",
    icon: Shield,
    content: [
      'As a platform admin, you manage the entire TradeOffice AI ecosystem.',
      'You can create and manage companies, onboard users, and monitor system health.',
      'Your admin dashboard gives you a bird\'s-eye view of all activity across the platform.',
    ],
  },
  {
    title: 'Platform Overview',
    subtitle: 'Here\'s what you can manage from the platform dashboard.',
    icon: Building2,
    content: [
      'Companies — Add and manage renovation companies on the platform.',
      'Users — See all users across companies, manage roles and access.',
      'System Health — Monitor API usage, edge function performance, and error rates.',
      'Settings — Configure platform-wide defaults and integrations.',
    ],
  },
  {
    title: 'User & Company Management',
    subtitle: 'You have full control over who uses the platform.',
    icon: Users,
    content: [
      'Create new companies and assign admins to run them.',
      'View all users across the platform with role-based filtering.',
      'Switch into any company\'s admin view with "Enter as Admin".',
      'Manage billing, subscriptions, and feature flags per company.',
    ],
  },
  {
    title: 'System Monitoring',
    subtitle: 'Keep an eye on how the platform is performing.',
    icon: Activity,
    content: [
      'The health dashboard shows real-time API usage and AI token consumption.',
      'Monitor edge function performance and error rates.',
      'Set up alerts for system issues before they affect users.',
      'Review AI agent activity and approval queues.',
    ],
  },
]

export function PlatformOnboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
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
        .update({ platform_onboarding_complete: true })
        .eq('id', user.id)
      navigate('/onboard/company')
    } catch {
      navigate('/onboard/company')
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
            <div className="w-10 h-10 rounded-xl bg-[var(--navy)] flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="font-display text-lg text-[var(--navy)]">Platform Setup</p>
              <p className="text-xs text-[var(--text-tertiary)]">Step {step + 1} of {STEPS.length}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--navy)] rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center pt-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--navy)] flex items-center justify-center mx-auto mb-4">
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
            onClick={isLast ? handleComplete : () => setStep(s => s + 1)}
            disabled={completing}
          >
            {completing ? (
              <><Loader2 size={16} className="animate-spin" /> Completing...</>
            ) : isLast ? (
              <><CheckCircle size={16} /> Complete & Set Up Company</>
            ) : (
              <>Continue <ArrowRight size={16} /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
