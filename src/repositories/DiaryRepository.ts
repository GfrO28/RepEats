import type { MealType } from '@/domain/mealTypes'
import type { NutritionValues } from '@/domain/foodNutrition'

export interface DiaryItem {
  foodId: string | null // null = registro rápido (solo kcal y macros)
  name: string // copia del nombre al registrar
  grams: number | null // null en el registro rápido
  nutrition: NutritionValues // kcal y macros ya calculados para esa cantidad
}

export interface DiaryMeal {
  type: MealType
  items: DiaryItem[]
}

export interface DiaryDay {
  date: string // 'YYYY-MM-DD' en hora local; también es el id del documento
  meals: DiaryMeal[] // comidas con un registro ese día (con ítems, o agregadas a mano aunque no estén en el perfil)
  hiddenMeals: MealType[] // comidas que el usuario quitó de este día
  mealTimes: Partial<Record<MealType, string>> // hora elegida/confirmada de cada comida ese día ("HH:mm"); sin
  // entrada para una comida, se sugiere una tentativa a partir de la comida anterior (ver `resolveMealTimes`)
}

export interface DiaryRepository {
  subscribeDay(date: string, onChange: (day: DiaryDay | null) => void): () => void
  // Los días que tienen registro entre dos fechas 'YYYY-MM-DD' (ambas incluidas); los días vacíos no aparecen
  subscribeRange(startDate: string, endDate: string, onChange: (days: DiaryDay[]) => void): () => void
  saveDay(day: DiaryDay): void
}
