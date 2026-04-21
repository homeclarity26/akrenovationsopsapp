import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Home, Clock, Camera, FileText, MoreHorizontal } from 'lucide-react'
import { AgentBar } from '@/components/ui/AgentBar'
import { Badge } from '@/components/ui/Badge'
import { ModeToggle } from '@/components/ui/ModeToggle'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { PoweredByFooter } from '@/components/ui/PoweredByFooter'
import { SafeBoundary } from '@/components/ui/SafeBoundary'
import { useAuth } from '@/context/AuthContext'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'
import { cn } from '@/lib/utils'

// 5-button action-first bottom bar. Replaces the old 7-tab nav (Projects,
// List, Stock, Schedule, Messages, etc.) which stacked above the chat-home
// quick-action row and created duplicate paths to the same actions. Those
// sections are reached via "More" → /employee/tools drawer instead. Keeps
// the bottom chrome to a single row.
const NAV = [
  { to: '/employee',        label: 'Home',  icon: Home,            exact: true, badge: 0 },
  { to: '/employee/time',   label: 'Clock', icon: Clock,           badge: 0 },
  { to: '/employee/photos', label: 'Photo', icon: Camera,          badge: 0 },
  { to: '/employee/notes',  label: 'Note',  icon: FileText,        badge: 0 },
  { to: '/employee/tools',  label: 'More',  icon: MoreHorizontal,  badge: 0 },
]

export function EmployeeLayout() {
  const { user } = useAuth()
  const { data: company } = useCompanyProfile()
  const { pathname } = useLocation()

  // Onboarding guard — only force the field wizard for actual employees.
  // Admins previewing the field view (via ModeToggle) don't need to
  // complete an employee-specific onboarding.
  if (user && user.role === 'employee' && !user.field_onboarding_complete) {
    return <Navigate to="/onboard/field" replace />
  }

  // When the AI v2 chat-first home owns the screen, hide the duplicate
  // chrome (old AgentBar pill, PoweredByFooter, the route-list scroll
  // padding). Chat IS the app; we keep only the slim top bar (mode
  // toggle + bell) and the bottom nav so the user can still leave the
  // chat for direct-data views (Projects, List, Stock, etc.).
  const aiChatHome = !!user?.ai_v2_enabled && pathname === '/employee'

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg)]">
      {/* Top bar — slim, mode toggle for admins + notification bell */}
      <header className="fixed top-0 left-0 right-0 h-11 bg-[var(--bg)] border-b border-[var(--border-light)] flex items-center justify-between px-3 z-40">
        <div className="flex items-center gap-2">
          <ModeToggle />
          {company?.name && (
            <span className="text-xs font-medium text-[var(--text-secondary)] truncate max-w-[140px]">{company.name}</span>
          )}
        </div>
        <SafeBoundary label="NotificationBell.employee"><NotificationBell viewAllHref="/employee/reminders" /></SafeBoundary>
      </header>

      <main className={cn(
        'flex-1 overflow-x-hidden',
        aiChatHome ? 'pt-11 pb-16' : 'pt-11 pb-20',
      )}>
        {/* Old AgentBar pill — dropped on the AI chat-first home (chat is
            the AI surface). Kept for legacy tile-grid users. */}
        {!aiChatHome && <AgentBar />}
        <Outlet />
        {!aiChatHome && <PoweredByFooter />}
      </main>

      {/* Bottom nav — 5 buttons */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border-light)] z-40">
        <div className="grid grid-cols-5 h-16">
          {NAV.map(({ to, label, icon: Icon, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors relative',
                  isActive ? 'text-[var(--rust)]' : 'text-[var(--text-tertiary)]'
                )
              }
            >
              <div className="relative">
                <Icon size={22} />
                {badge > 0 && (
                  <Badge count={badge} className="absolute -top-1.5 -right-1.5" />
                )}
              </div>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  )
}
