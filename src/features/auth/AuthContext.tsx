import { createContext, type ReactNode, useEffect, useState } from 'react'
import { firebaseAuthRepository } from '@/data/firestore/authRepository'
import type { AuthUser } from '@/repositories/AuthRepository'

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = firebaseAuthRepository.subscribe((nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
