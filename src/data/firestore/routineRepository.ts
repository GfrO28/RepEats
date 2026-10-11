import { auth, db } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import type { Routine, RoutineRepository } from '@/repositories/RoutineRepository'

function routinesCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return collection(db, 'users', uid, 'routines')
}

function saveRoutine(routine: Routine) {
  setDoc(doc(routinesCollection(), routine.id), routine)
}

// Las rutinas guardadas antes de existir el orden manual o la hora sugerida no traen esos campos
type StoredRoutine = Omit<Routine, 'id' | 'order' | 'suggestedTime'> & Partial<Pick<Routine, 'order' | 'suggestedTime'>>

function toRoutine(id: string, data: StoredRoutine): Routine {
  return { ...data, id, order: data.order ?? Number.MAX_SAFE_INTEGER, suggestedTime: data.suggestedTime ?? null }
}

export const firebaseRoutineRepository: RoutineRepository = {
  generateRoutineId() {
    return doc(routinesCollection()).id
  },
  subscribeRoutines(onChange) {
    return onSnapshot(routinesCollection(), (snapshot) => {
      const routines = snapshot.docs.map((docSnap) => toRoutine(docSnap.id, docSnap.data() as StoredRoutine))
      onChange(routines)
    })
  },
  addRoutine(routine) {
    saveRoutine(routine)
  },
  updateRoutine(routine) {
    saveRoutine(routine)
  },
  deleteRoutine(id) {
    deleteDoc(doc(routinesCollection(), id))
  },
}
