import { auth, db } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import type { WeighInRepository } from '@/repositories/WeighInRepository'

// Con un pesaje por día son ~6 meses: de sobra para la tendencia y el gasto observado, y acota las lecturas
const HISTORY_LIMIT = 180

function weighInsCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return collection(db, 'users', uid, 'weighIns')
}

export const firebaseWeighInRepository: WeighInRepository = {
  subscribeWeighIns(onChange) {
    const recent = query(weighInsCollection(), orderBy('date', 'desc'), limit(HISTORY_LIMIT))
    return onSnapshot(recent, (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => ({ date: docSnap.id, weightKg: (docSnap.data() as { weightKg: number }).weightKg })),
      )
    })
  },
  saveWeighIn(weighIn) {
    // Sin await (offline-first): la UI se actualiza con onSnapshot desde la caché local
    setDoc(doc(weighInsCollection(), weighIn.date), weighIn)
  },
  deleteWeighIn(date) {
    deleteDoc(doc(weighInsCollection(), date))
  },
}
