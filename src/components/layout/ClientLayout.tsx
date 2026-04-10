import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart2, Image, DollarSign,
  MessageCircle, FileText, ShoppingBag, Calendar, ClipboardList, Heart
} from 'lucide-react'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ClientOnboarding } from '@/pages/onboarding/ClientOnboarding'
import { PWAPrompt } from '@/components/ui/PWAPrompt'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/client/progress',   label: 'Progress',   icon: BarChart2 },
  { to: '/client/photos',     label: 'Photos',     icon: Image },
  { to: '/client/selections', label: 'Selections', icon: ShoppingBag },
  { to: '/client/invoices',   label: 'Invoices',   icon: DollarSign },
  { to: '/client/messages',   label: 'Messages',   icon: MessageCircle },
  { to: '/client/schedule',   label: 'Schedule',   icon: Calendar },
  { to: '/client/punch',      label: 'Punch List', icon: ClipboardList },
  { to: '/client/docs',       label: 'Docs',       icon: FileText },
  { to: '/client/referral',   label: 'Refer',      icon: Heart },
]

export function ClientLayout() {
  const { data: company } = useCompanyProfile()
  const { user } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPWA, setShowPWA] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.onboarding_complete) setShowOnboarding(true)
        else setShowPWA(true)
      })
  }, [user])

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg)]">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 bg-[var(--navy)] z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="font-display text-white text-base">{company?.name ?? 'Your Contractor'}</span>
            <p className="text-white/60 text-xs">Your Project Portal</p>
          </div>
        </div>
        {/* Inline tab nav on mobile */}
        <div className="flex overflow-x-auto border-t border-white/10 hide-scrollbar">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-4 py-2.5 text-[10px] font-medium transition-colors flex-shrink-0',
                  isActive ? 'text-white border-b-2 border-[var(--rust)]' : 'text-white/50 hover:text-white/80'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="flex-1 pt-28 pb-6 overflow-x-hidden">
        <Outlet />
      </main>
      {showOnboarding && (
        <ClientOnboarding onComplete={() => { setShowOnboarding(false); setShowPWA(true) }} />
      )}
      {!showOnboarding && showPWA && <PWAPrompt role="client" />}
    </div>
  )
}
