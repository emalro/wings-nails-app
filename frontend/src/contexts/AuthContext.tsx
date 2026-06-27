import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, setToken, clearToken } from '../api'

export interface User {
  email: string
  role: string
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

// Deferred promise for router beforeLoad — resolves after initial /auth/me completes
let resolveAuthPromise!: (state: { user: User | null; isAuthenticated: boolean; isLoading: boolean }) => void
export const authPromise: Promise<{ user: User | null; isAuthenticated: boolean; isLoading: boolean }> = new Promise((resolve) => {
  resolveAuthPromise = resolve
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip interceptor to avoid redirect loop on initial check
        const response = await api.get('/auth/me', { skipAuthRefresh: true } as any)
        setUser(response.data)
        resolveAuthPromise({ user: response.data, isAuthenticated: true, isLoading: false })
      } catch {
        // Not authenticated — clear any stale token
        clearToken()
        setUser(null)
        resolveAuthPromise({ user: null, isAuthenticated: false, isLoading: false })
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    setToken(response.data.access_token)
    setUser(response.data.user)
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}