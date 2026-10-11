import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { sumNutrition, type NutritionValues } from './foodNutrition'

export function createSavedMeal(id: string, name: string, items: readonly DiaryItem[]): SavedMeal {
  return { id, name: name.trim(), items: [...items] }
}

// Renombra y/o cambia los ítems de una comida guardada ya existente, conservando su id
export function updateSavedMeal(meal: SavedMeal, name: string, items: readonly DiaryItem[]): SavedMeal {
  return { ...meal, name: name.trim(), items: [...items] }
}

export function calculateSavedMealTotals(meal: SavedMeal): NutritionValues {
  return sumNutrition(meal.items.map((item) => item.nutrition))
}

// Alfabético, sin importar mayúsculas ni tildes (la lista original no se modifica)
export function sortSavedMeals(meals: readonly SavedMeal[]): SavedMeal[] {
  return [...meals].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}
