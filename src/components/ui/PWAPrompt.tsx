// PWAPrompt — PR #19
// Bottom sheet shown once to mobile employees and clients after onboarding.
// Guides them through "Add to Home Screen" for their platform.
// Never shown to admins on desktop. Dismissed permanently via profiles table.

import { useState, useEffect } from 'react'
import { X, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

function getOS(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

function isMobile(): boolean {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

interface Props {
  role: 'employee' | 'client'
}

export function PWAPrompt({ role }: Props) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const os = getOS()

  useEffect(() => {
    if (!user) return
    if (!isMobile()) return       // Desktop admins — never show
    if (isStandalone()) return    // Already installed
    if (role === 'admin') return  // Admins excluded per spec

    // Check if already shown
    supabase.from('profiles')
      .select('pwa_prompt_shown')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.pwa_prompt_shown) setVisible(true)
      })
  }, [user, role])

  const dismiss = async () => {
    setVisible(false)
    if (user) {
      await supabase.from('profiles')
        .update({ pwa_prompt_shown: true })
        .eq('id', user.id)
    }
  }

  if (!visible || os === 'other') return null

  const steps = os === 'ios'
    ? [
        { n: 1, text: 'Tap the Share button at the bottom of Safari' },
        { n: 2, text: 'Scroll down and tap "Add to Home Screen"' },
        { n: 3, text: 'Tap "Add" in the top right corner' },
      ]
    : [
        { n: 1, text: 'Tap the three dots in the top right of Chrome' },
        { n: 2, text: 'Tap "Add to Home Screen"' },
        { n: 3, text: 'Tap "Add"' },
      ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="bg-[var(--white)] rounded-t-3xl px-5 pt-5 pb-10 safe-bottom"
        style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.15)' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--navy)' }}>
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)] text-base">Save to your phone</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Access your dashboard from your home screen</p>
            </div>
          </div>
          <button onClick={dismiss} className="p-1.5 rounded-lg" style={{ background: 'var(--bg)' }}>
            <X size={16} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">
          {os === 'ios' ? 'iPhone — Safari' : 'Android — Chrome'}
        </p>

        <div className="space-y-3 mb-6">
          {steps.map(step => (
            <div key={step.n} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: 'var(--navy)' }}
              >
                {step.n}
              </div>
              <p className="text-sm text-[var(--text)]">{step.text}</p>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm"
          style={{ background: 'var(--navy)', color: '#fff' }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
