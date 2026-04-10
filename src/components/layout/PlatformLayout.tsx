import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, Menu, X, LogOut,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/platform',            label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { to: '/platform/companies',  label: 'Companies',  icon: Building2 },
  { to: '/platform/users',      label: 'Users',      icon: Users },
]

export function PlatformLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { signOut } = useAuth()

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-60 bg-[var(--navy)] z-40">
        <div className="px-5 py-6 border-b border-white/10">
          <BrandLogo variant="platform" size="lg" />
          <p className="text-white/50 text-xs mt-1.5">Platform Admin</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
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
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-11 bg-[var(--bg)] border-b border-[var(--border-light)] flex items-center justify-between px-3 z-40">
        <span className="font-display text-base text-[var(--navy)] font-medium">TradeOffice AI</span>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--navy)] hover:bg-white transition-colors"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute right-2 top-12 w-52 bg-[var(--navy)] rounded-2xl p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            {NAV.map(({ to, label, icon: Icon, exact }) => (
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
            <button
              onClick={() => { setMenuOpen(false); signOut() }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full mt-1 border-t border-white/10 pt-2"
            >
              <LogOut size={17} />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-11 lg:pt-0 pb-20 lg:pb-0 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border-light)] z-40 safe-area-bottom">
        <div className="grid grid-cols-3 h-16">
          {NAV.map(({ to, label, icon: Icon, exact }) => (
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
    </div>
  )
}
