import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '@/firebase'
import type { AuthRepository } from '@/repositories/AuthRepository'

export const firebaseAuthRepository: AuthRepository = {
  async signIn(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  },

  async signOut() {
    await firebaseSignOut(auth)
  },

  subscribe(onChange) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      onChange(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null)
    })
  },
}
