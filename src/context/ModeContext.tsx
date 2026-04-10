import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

type AppMode = 'admin' | 'field'

interface ModeContextValue {
  currentMode: AppMode
  toggleMode: () => void
  canToggle: boolean
}

const STORAGE_KEYS = {
  mode: 'tradeoffice_mode',
  adminRoute: 'tradeoffice_admin_route',
  fieldRoute: 'tradeoffice_field_route',
  adminScroll: 'tradeoffice_admin_scroll',
  fieldScroll: 'tradeoffice_field_scroll',
} as const

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const canToggle = user?.role === 'admin' || user?.role === 'super_admin'

  const [currentMode, setCurrentMode] = useState<AppMode>(() => {
    if (!canToggle) return 'admin'
    const stored = localStorage.getItem(STORAGE_KEYS.mode) as AppMode | null
    return stored === 'field' ? 'field' : 'admin'
  })

  // Track current route into localStorage so we can restore it on toggle-back
  useEffect(() => {
    if (!canToggle) return
    const path = location.pathname
    if (currentMode === 'admin' && path.startsWith('/admin')) {
      localStorage.setItem(STORAGE_KEYS.adminRoute, path)
    } else if (currentMode === 'field' && path.startsWith('/employee')) {
      localStorage.setItem(STORAGE_KEYS.fieldRoute, path)
    }
  }, [location.pathname, currentMode, canToggle])

  const toggleMode = useCallback(() => {
    if (!canToggle) return

    // Save scroll position for current mode
    const scrollY = window.scrollY
    if (currentMode === 'admin') {
      localStorage.setItem(STORAGE_KEYS.adminScroll, String(scrollY))
    } else {
      localStorage.setItem(STORAGE_KEYS.fieldScroll, String(scrollY))
    }

    const nextMode: AppMode = currentMode === 'admin' ? 'field' : 'admin'

    // Determine target route
    let targetRoute: string
    if (nextMode === 'field') {
      targetRoute = localStorage.getItem(STORAGE_KEYS.fieldRoute) || '/employee'
    } else {
      targetRoute = localStorage.getItem(STORAGE_KEYS.adminRoute) || '/admin'
    }

    // Persist mode
    localStorage.setItem(STORAGE_KEYS.mode, nextMode)
    setCurrentMode(nextMode)

    // Navigate, then restore scroll after the page renders
    navigate(targetRoute)

    const savedScroll = nextMode === 'field'
      ? localStorage.getItem(STORAGE_KEYS.fieldScroll)
      : localStorage.getItem(STORAGE_KEYS.adminScroll)

    if (savedScroll) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, Number(savedScroll))
        })
      })
    }
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
