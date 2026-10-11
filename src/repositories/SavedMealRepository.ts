import type { DiaryItem } from './DiaryRepository'

// Una comida guardada ("mi desayuno de siempre"): un conjunto de alimentos que se agrega de una vez.
// Guarda los ítems con sus valores ya calculados, como el diario: si un alimento cambia o se borra, no se altera.
export interface SavedMeal {
  id: string
  name: string
  items: DiaryItem[]
}

export interface SavedMealRepository {
  generateSavedMealId(): string
  subscribeSavedMeals(onChange: (meals: SavedMeal[]) => void): () => void
  addSavedMeal(meal: SavedMeal): void
  updateSavedMeal(meal: SavedMeal): void
  deleteSavedMeal(id: string): void
}
