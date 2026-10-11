import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
