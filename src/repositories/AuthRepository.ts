export interface AuthUser {
  uid: string
  email: string | null
}

export interface AuthRepository {
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  subscribe(onChange: (user: AuthUser | null) => void): () => void
}