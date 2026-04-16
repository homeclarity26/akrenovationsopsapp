import { useState, useEffect } from 'react'
import {
  Sparkles, Mic, BarChart3, Package,
  Eye, Columns3, MessageCircle, X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type Persona = 'admin' | 'field' | 'client'

interface Slide {
  icon: React.ElementType
  title: string
  body: string
}

const SLIDES: Record<Persona, Slide[]> = {
  admin: [
    { icon: Sparkles, title: 'Meet Your AI Team', body: 'Twenty-seven agents work behind the scenes — writing proposals, chasing invoices, and keeping projects on track.' },
    { icon: BarChart3, title: 'The Agent Bar', body: 'Type a plain-English command at the top of any page. "Draft a proposal for the Miller kitchen" — done.' },
    { icon: Eye, title: 'Your Dashboard', body: 'Outstanding AR, margin alerts, and crew needs — everything rolls up here so nothing slips through the cracks.' },
  ],
  field: [
    { icon: Sparkles, title: 'Your Pocket Co-Worker', body: 'Clock in, log receipts, snap photos, and request tools — all from your phone, no paperwork.' },
    { icon: Mic, title: 'Voice-First', body: 'Tap the mic to dictate daily logs, shopping lists, and notes. The AI cleans them up for you.' },
    { icon: Package, title: 'Stocktake', body: 'Scan materials on site, flag shortages, and the office gets notified instantly.' },
  ],
  client: [
    { icon: Eye, title: 'Live Progress', body: 'See exactly where your project stands — phase by phase, percentage by percentage — updated daily.' },
    { icon: Columns3, title: 'Your Portal', body: 'Photos, invoices, documents, schedule, and selections — everything in one place, no phone tag.' },
    { icon: MessageCircle, title: 'Direct Messaging', body: 'Message your contractor right here. Questions, change orders, approvals — it all stays on the record.' },
  ],
}

function storageKey(persona: Persona, userId: string) {
  return `ak_first_visit_${persona}_${userId}`
}

interface FirstVisitWizardProps {
  persona: Persona
}

export function FirstVisitWizard({ persona }: FirstVisitWizardProps) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    const key = storageKey(persona, user.id)
    if (!localStorage.getItem(key)) {
      setVisible(true)
    }
  }, [user?.id, persona])

  function dismiss() {
    if (user?.id) localStorage.setItem(storageKey(persona, user.id), '1')
    setVisible(false)
  }

  if (!visible) return null

  const slides = SLIDES[persona]
  const slide = slides[step]
  const Icon = slide.icon
  const isLast = step === slides.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--border-light)] flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--border)] transition-colors z-10"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="px-6 pt-10 pb-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--navy)] flex items-center justify-center mb-5">
            <Icon size={26} className="text-white" />
          </div>
          <h2 className="font-display text-xl text-[var(--navy)] mb-2">{slide.title}</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{slide.body}</p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-[var(--navy)]' : 'bg-[var(--border)]'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep(s => s + 1)}
            className="flex-1 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
