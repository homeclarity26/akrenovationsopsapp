// ClientOnboarding — PR #19
// 2-screen first-login walkthrough for homeowner/client users.

import { useState } from 'react'
import { BarChart2, CreditCard, ArrowRight, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const SCREENS = [
  {
    icon: BarChart2,
    title: 'Track Your Project',
    body: 'See real-time progress, daily photos from your job site, and the current phase of your project — all updated by your contractor.',
    cta: 'Next',
  },
  {
    icon: CreditCard,
    title: 'View & Pay Invoices',
    body: 'Your invoices appear here when they're ready. Review the details and pay securely — no phone calls or paper checks needed.',
    cta: 'Take me to my project',
  },
]

interface Props {
  onComplete: () => void
}

export function ClientOnboarding({ onComplete }: Props) {
  const { user } = useAuth()
  const [screen, setScreen] = useState(0)
  const current = SCREENS[screen]
  const Icon = current.icon
  const isLast = screen === SCREENS.length - 1

  const advance = async () => {
    if (isLast) {
      if (user) {
        await supabase.from('profiles')
          .update({ onboarding_complete: true })
          .eq('id', user.id)
      }
      onComplete()
    } else {
      setScreen(s => s + 1)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(27,43,77,0.96)', backdropFilter: 'blur(8px)' }}
    >
      <div className="flex gap-2 mb-10">
        {SCREENS.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === screen ? 24 : 6,
              background: i <= screen ? 'var(--rust)' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>

      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        <Icon size={36} className="text-white" />
      </div>

      <h2 className="font-display text-3xl text-white text-center mb-3">{current.title}</h2>
      <p className="text-white/60 text-center text-base leading-relaxed mb-10 max-w-xs">{current.body}</p>

      {screen > 0 && (
        <div className="flex flex-col gap-2 mb-8 w-full max-w-xs">
          {SCREENS.slice(0, screen).map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--rust)' }}>
                <Check size={11} className="text-white" />
              </div>
              <span className="text-white/70 text-sm">{s.title}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={advance}
        className="w-full max-w-xs py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2"
        style={{ background: 'var(--rust)', color: '#fff' }}
      >
        {current.cta}
        {!isLast && <ArrowRight size={18} />}
      </button>
    </div>
  )
}
