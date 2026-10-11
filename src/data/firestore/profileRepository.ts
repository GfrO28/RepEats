import { auth, db } from '@/firebase'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import type { Profile, ProfileRepository } from '@/repositories/ProfileRepository'

function profileDoc() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return doc(db, 'users', uid, 'profile', 'main')
}

export const firebaseProfileRepository: ProfileRepository = {
  subscribeProfile(onChange) {
    return onSnapshot(profileDoc(), (snapshot) => {
      // TODO: si snapshot.exists() es true, onChange(snapshot.data() as Profile)
      // si no, onChange(null)
      if (snapshot.exists()) {
        // Los perfiles guardados antes de existir estos campos no los traen: se completan con su valor por defecto
        type StoredKeys = 'optionalMeals' | 'adaptiveTdee'
        const data = snapshot.data() as Omit<Profile, StoredKeys> & Partial<Pick<Profile, StoredKeys>>
        onChange({
          ...data,
          optionalMeals: data.optionalMeals ?? [],
          adaptiveTdee: data.adaptiveTdee ?? null,
        })
      } else {
        onChange(null)
      }
    })
  },
  saveProfile(profile) {
    // TODO: setDoc(profileDoc(), profile) — sin await (offline-first, regla del CLAUDE.md)
    setDoc(profileDoc(), profile)
  },
}
