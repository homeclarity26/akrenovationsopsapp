import { useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Users, FolderOpen, DollarSign,
  Calendar, Sparkles, Settings, Menu, X, FileText,
  Receipt, ClipboardList, HardHat, Shield, Wallet, ArrowLeft
} from 'lucide-react'
import { AIBar } from '@/components/ui/AIBar'
import { APIUsageBar } from '@/components/ui/APIUsageBar'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { ModeToggle } from '@/components/ui/ModeToggle'
import { useAuth } from '@/context/AuthContext'
import { useCompanyProfile } from '@/hooks/useCompanyProfile'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin',              label: 'Home',      icon: LayoutDashboard, exact: true },
  { to: '/admin/crm',          label: 'CRM',       icon: Users },
  { to: '/admin/projects',     label: 'Projects',  icon: FolderOpen },
  { to: '/admin/financials',   label: 'Money',     icon: DollarSign },
  { to: '/admin/schedule',     label: 'Schedule',  icon: Calendar },
  { to: '/admin/invoices',     label: 'Invoices',  icon: Receipt },
  { to: '/admin/proposals',    label: 'Proposals', icon: FileText },
  { to: '/admin/walkthrough',  label: 'Site Walk', icon: ClipboardList },
  { to: '/admin/subs',         label: 'Subs',      icon: HardHat },
  { to: '/admin/payroll',      label: 'Payroll',   icon: Wallet },
  { to: '/admin/compliance',   label: 'Compliance',icon: Shield },
]

export function AdminLayout() {
  const [aiOpen, setAiOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const { data: company } = useCompanyProfile()
  const isSuperAdmin = user?.role === 'super_admin'

  // Onboarding guards — redirect to the appropriate wizard if incomplete
  if (isSuperAdmin && !user?.platform_onboarding_complete) {
    return <Navigate to="/onboard/platform" replace />
  }
  if ((isSuperAdmin || user?.role === 'admin') && !user?.company_onboarding_complete) {
    return <Navigate to="/onboard/company" replace />
  }

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-60 bg-[var(--navy)] z-40">
        <div className="px-5 py-6 border-b border-white/10">
          <BrandLogo
            variant="company"
            companyName={company?.name}
            logoUrl={company?.logo_url}
            size="lg"
          />
          <div className="mt-3">
            <ModeToggle />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {isSuperAdmin && (
            <NavLink
              to="/platform"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors mb-2 border-b border-white/10 pb-3"
            >
              <ArrowLeft size={18} />
              Back to Platform
            </NavLink>
          )}
          {NAV.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--rust)] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-0.5">
          <div className="px-3 py-2">
            <APIUsageBar className="w-full justify-center" />
          </div>
          <NavLink
            to="/admin/ai"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-[var(--rust)] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
              )
            }
          >
            <Sparkles size={18} />
            AI Command
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-[var(--rust)] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
              )
            }
          >
            <Settings size={18} />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Mobile top bar — slim, white, just icons */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-11 bg-[var(--bg)] border-b border-[var(--border-light)] flex items-center justify-between px-3 z-40 gap-1">
        <ModeToggle />
        <div className="flex items-center gap-1">
        <APIUsageBar className="mr-1" />
        <button
          onClick={() => setAiOpen(true)}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-white transition-colors"
        >
          <Sparkles size={18} />
        </button>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-white transition-colors"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute right-2 top-12 w-52 bg-[var(--navy)] rounded-2xl p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            {[...(isSuperAdmin ? [{ to: '/platform', label: 'Back to Platform', icon: ArrowLeft, exact: false }] : []), ...NAV, { to: '/admin/ai', label: 'AI Command', icon: Sparkles, exact: false }, { to: '/admin/settings', label: 'Settings', icon: Settings, exact: false }].map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                    isActive ? 'bg-[var(--rust)] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                  )
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-11 lg:pt-0 pb-20 lg:pb-0 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Mobile bottom nav — only top 5 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border-light)] z-40 safe-area-bottom">
        <div className="grid grid-cols-5 h-16">
          {NAV.slice(0, 5).map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-[var(--rust)]' : 'text-[var(--text-tertiary)]'
                )
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {aiOpen && <AIBar onClose={() => setAiOpen(false)} />}
    </div>
  )
}
