import { createContext, useContext, useState, type ReactNode } from 'react'
import { MOCK_USERS } from '@/data/mock'

type Role = 'admin' | 'employee' | 'client'

interface User {
  id: string
  role: Role
  full_name: string
  email: string
  avatar_url: string | null
}

interface AuthContextValue {
  user: User | null
  login: (userId: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ak-ops-user')
    return saved ? JSON.parse(saved) : null
  })

  const login = (userId: string) => {
    const found = MOCK_USERS.find(u => u.id === userId)
    if (found) {
      setUser(found)
      localStorage.setItem('ak-ops-user', JSON.stringify(found))
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('ak-ops-user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
