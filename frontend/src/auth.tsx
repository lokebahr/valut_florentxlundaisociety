import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type AuthState = {
  token: string | null
  setToken: (t: string | null) => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

const STORAGE_KEY = 'valut_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  const setToken = (t: string | null) => {
    setTokenState(t)
    if (t) localStorage.setItem(STORAGE_KEY, t)
    else localStorage.removeItem(STORAGE_KEY)
  }

  const value = useMemo(() => ({ token, setToken }), [token])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
