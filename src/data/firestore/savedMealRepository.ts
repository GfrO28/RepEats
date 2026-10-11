import { auth, db } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import type { SavedMeal, SavedMealRepository } from '@/repositories/SavedMealRepository'

function savedMealsCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return collection(db, 'users', uid, 'savedMeals')
}

export const firebaseSavedMealRepository: SavedMealRepository = {
  generateSavedMealId() {
    return doc(savedMealsCollection()).id
  },
  subscribeSavedMeals(onChange) {
    return onSnapshot(savedMealsCollection(), (snapshot) => {
      onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as SavedMeal))
    })
  },
  addSavedMeal(meal) {
    setDoc(doc(savedMealsCollection(), meal.id), meal)
  },
  updateSavedMeal(meal) {
    setDoc(doc(savedMealsCollection(), meal.id), meal)
  },
  deleteSavedMeal(id) {
    deleteDoc(doc(savedMealsCollection(), id))
  },
}
