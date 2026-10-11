import { auth, db } from '@/firebase'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  increment,
  Timestamp,
} from 'firebase/firestore'
import type { Food, FoodRepository, FoodSource, Recipe } from '@/repositories/FoodRepository'
import type { MealType } from '@/domain/mealTypes'

function foodsCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return collection(db, 'users', uid, 'foods')
}

function foodRef(id: string) {
  return doc(foodsCollection(), id)
}

// Los alimentos guardados antes de existir favoritos y uso no tienen esos campos
type StoredFood = Omit<
  Food,
  | 'id'
  | 'isFavorite'
  | 'useCount'
  | 'useCountByMeal'
  | 'lastUsedAt'
  | 'recipe'
  | 'isPreparedDish'
  | 'brand'
  | 'barcode'
  | 'source'
> &
  Partial<{
    isFavorite: boolean
    useCount: number
    useCountByMeal: Partial<Record<MealType, number>>
    lastUsedAt: Timestamp | null
    recipe: Recipe | null
    isPreparedDish: boolean
    brand: string | null
    barcode: string | null
    source: FoodSource
  }>

function toFood(id: string, data: StoredFood): Food {
  return {
    ...data,
    id,
    isFavorite: data.isFavorite ?? false,
    useCount: data.useCount ?? 0,
    useCountByMeal: data.useCountByMeal ?? {},
    lastUsedAt: data.lastUsedAt?.toDate() ?? null,
    recipe: data.recipe ?? null,
    isPreparedDish: data.isPreparedDish ?? false,
    brand: data.brand ?? null,
    barcode: data.barcode ?? null,
    source: data.source ?? 'manual',
  }
}

export const firebaseFoodRepository: FoodRepository = {
  generateFoodId() {
    return doc(foodsCollection()).id
  },
  subscribeFoods(onChange) {
    return onSnapshot(foodsCollection(), (snapshot) => {
      onChange(snapshot.docs.map((docSnap) => toFood(docSnap.id, docSnap.data() as StoredFood)))
    })
  },
  addFood(food) {
    setDoc(foodRef(food.id), food)
  },
  addFoods(foods) {
    // Un lote admite hasta 500 escrituras: se parte en tandas de 400 (sin await, igual que el resto)
    for (let start = 0; start < foods.length; start += 400) {
      const batch = writeBatch(db)
      foods.slice(start, start + 400).forEach((food) => batch.set(foodRef(food.id), food))
      // Sin await (offline-first), pero un fallo queda registrado en la consola en vez de perderse en silencio
      batch.commit().catch((error: unknown) => {
        console.error(`Importación: falló el lote que empieza en el alimento ${start + 1}`, error)
      })
    }
  },
  // Solo los campos editables: así no se pisa un favorito o un uso registrado mientras se editaba
  updateFood(food) {
    updateDoc(foodRef(food.id), {
      name: food.name,
      brand: food.brand,
      barcode: food.barcode,
      per100g: food.per100g,
      unit: food.unit,
      recipe: food.recipe,
    })
  },
  deleteFood(id) {
    deleteDoc(foodRef(id))
  },
  setFavorite(id, isFavorite) {
    updateDoc(foodRef(id), { isFavorite })
  },
  markUsed(id, mealType) {
    // La ruta con punto suma dentro del mapa sin pisar el resto de comidas ni crear el campo si aún no existía
    updateDoc(foodRef(id), {
      useCount: increment(1),
      lastUsedAt: Timestamp.now(),
      [`useCountByMeal.${mealType}`]: increment(1),
    })
  },
}
