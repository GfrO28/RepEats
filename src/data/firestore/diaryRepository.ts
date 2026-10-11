import { auth, db } from '@/firebase'
import { collection, doc, documentId, onSnapshot, query, setDoc, where } from 'firebase/firestore'
import type { DiaryDay, DiaryRepository } from '@/repositories/DiaryRepository'

function diaryCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return collection(db, 'users', uid, 'diary')
}

function diaryDoc(date: string) {
  return doc(diaryCollection(), date)
}

// El id del documento es la fecha; estos campos se completan por si el documento es anterior a ellos
type StoredKeys = 'hiddenMeals' | 'mealTimes'
type StoredDay = Omit<DiaryDay, 'date' | StoredKeys> & Partial<Pick<DiaryDay, StoredKeys>>

function toDiaryDay(date: string, data: StoredDay): DiaryDay {
  return { ...data, date, hiddenMeals: data.hiddenMeals ?? [], mealTimes: data.mealTimes ?? {} }
}

export const firebaseDiaryRepository: DiaryRepository = {
  subscribeDay(date, onChange) {
    return onSnapshot(diaryDoc(date), (snapshot) => {
      if (snapshot.exists()) {
        onChange(toDiaryDay(snapshot.id, snapshot.data() as StoredDay))
      } else {
        onChange(null)
      }
    })
  },
  subscribeRange(startDate, endDate, onChange) {
    // Los ids son fechas 'YYYY-MM-DD', que se ordenan igual como texto que como calendario
    const range = query(diaryCollection(), where(documentId(), '>=', startDate), where(documentId(), '<=', endDate))
    return onSnapshot(range, (snapshot) => {
      onChange(snapshot.docs.map((docSnap) => toDiaryDay(docSnap.id, docSnap.data() as StoredDay)))
    })
  },
  saveDay(day) {
    setDoc(diaryDoc(day.date), day)
  },
}
