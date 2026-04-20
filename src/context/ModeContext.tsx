import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

type AppMode = 'admin' | 'field'

interface ModeContextValue {
  currentMode: AppMode
  toggleMode: () => void
  canToggle: boolean
}

// Only the persisted user preference across sessions (admin starts in admin
// mode unless they last used field). Scroll/last-route restoration was
// removed 2026-04-19 after Adam reported toggling to Field and landing on
// a stale /employee/notes instead of /employee home, then finding the
// sub-page Back arrow escaping to /admin because the push-navigation
// left /admin in history.
const STORAGE_KEY_MODE = 'tradeoffice_mode'

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Admin↔Field toggle is scoped to a single company. platform_owner does
  // NOT get it — they run a separate UI at /platform.
  const canToggle = user?.role === 'admin'

  const [currentMode, setCurrentMode] = useState<AppMode>(() => {
    if (!canToggle) return 'admin'
    const stored = localStorage.getItem(STORAGE_KEY_MODE) as AppMode | null
    return stored === 'field' ? 'field' : 'admin'
  })

  const toggleMode = useCallback(() => {
    if (!canToggle) return

    const nextMode: AppMode = currentMode === 'admin' ? 'field' : 'admin'
    const targetRoute = nextMode === 'field' ? '/employee' : '/admin'

    localStorage.setItem(STORAGE_KEY_MODE, nextMode)
    setCurrentMode(nextMode)

    // replace:true so /admin doesn't sit in history when user is now on
    // /employee — a sub-page Back arrow (useBackNavigation) should bounce
    // the user to /employee home, not escape back to admin.
    navigate(targetRoute, { replace: true })
  }, [canToggle, currentMode, navigate])

  return (
    <ModeContext.Provider value={{ currentMode, toggleMode, canToggle }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode must be used within ModeProvider')
  return ctx
}
