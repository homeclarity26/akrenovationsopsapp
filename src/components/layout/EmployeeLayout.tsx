import { useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import {
  Home, ShoppingCart, Clock, Calendar,
  MessageCircle, Sparkles, FolderOpen, Package
} from 'lucide-react'
import { AIBar } from '@/components/ui/AIBar'
import { Badge } from '@/components/ui/Badge'
import { ModeToggle } from '@/components/ui/ModeToggle'
import { useAuth } from '@/context/AuthContext'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'
import { cn } from '@/lib/utils'

// Badge counts are not wired to real data yet — keep them at 0 until the
// unread/pending queries exist so users never see fake notification counts.
const NAV = [
  { to: '/employee',           label: 'Home',     icon: Home,            exact: true, badge: 0 },
  { to: '/employee/projects',  label: 'Projects', icon: FolderOpen,      badge: 0 },
  { to: '/employee/shopping',  label: 'List',     icon: ShoppingCart,    badge: 0 },
  { to: '/employee/stocktake', label: 'Stock',    icon: Package,         badge: 0 },
  { to: '/employee/time',      label: 'Clock',    icon: Clock,           badge: 0 },
  { to: '/employee/schedule',  label: 'Schedule', icon: Calendar,        badge: 0 },
  { to: '/employee/messages',  label: 'Messages', icon: MessageCircle,   badge: 0 },
]

export function EmployeeLayout() {
  const [aiOpen, setAiOpen] = useState(false)
  const { user } = useAuth()
  const { data: company } = useCompanyProfile()

  // Onboarding guard — redirect to field wizard if incomplete
  if (user && !user.field_onboarding_complete) {
    return <Navigate to="/onboard/field" replace />
  }

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg)]">
      {/* Top bar — slim, mode toggle for admins + AI button */}
      <header className="fixed top-0 left-0 right-0 h-11 bg-[var(--bg)] border-b border-[var(--border-light)] flex items-center justify-between px-3 z-40">
        <div className="flex items-center gap-2">
          <ModeToggle />
          {company?.name && (
            <span className="text-xs font-medium text-[var(--text-secondary)] truncate max-w-[140px]">{company.name}</span>
          )}
        </div>
        <button
          onClick={() => setAiOpen(true)}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-white transition-colors"
        >
          <Sparkles size={18} />
        </button>
      </header>

      <main className="flex-1 pt-11 pb-20 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border-light)] z-40">
        <div className="grid grid-cols-7 h-16">
          {NAV.map(({ to, label, icon: Icon, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative',
                  isActive ? 'text-[var(--rust)]' : 'text-[var(--text-tertiary)]'
                )
              }
            >
              <div className="relative">
                <Icon size={20} />
                {badge > 0 && (
                  <Badge count={badge} className="absolute -top-1.5 -right-1.5" />
                )}
              </div>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {aiOpen && <AIBar onClose={() => setAiOpen(false)} placeholder="Ask about today's job, materials, or schedule..." />}
    </div>
  )
}
