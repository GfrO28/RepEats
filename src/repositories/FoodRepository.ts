// src/repositories/FoodRepository.ts
import type { NutritionValues } from '@/domain/foodNutrition'
import type { MealType } from '@/domain/mealTypes'

export interface FoodUnit {
  label: string
  grams: number
}

// Un ingrediente de receta guarda ya calculados los valores de su cantidad: si el alimento original
// cambia o se borra, la receta no se altera (mismo principio que el diario)
export interface RecipeIngredient {
  foodId: string | null
  name: string
  grams: number
  nutrition: NutritionValues
}

export interface Recipe {
  ingredients: RecipeIngredient[]
  cookedGrams: number // peso final ya cocido: es el que reparte los valores por 100 g
  servings: number | null // en cuántas porciones rinde (opcional)
}

// De dónde salieron los valores: sirve para saber qué tan fiables son y para refrescarlos si cambian
export type FoodSource =
  | 'manual' // escritos a mano, sin producto de por medio
  | 'label' // copiados de la etiqueta de un producto envasado
  | 'openFoodFacts' // traídos de Open Food Facts (base colaborativa)
  | 'import' // cargados con el importador JSON (p. ej. las Tablas Peruanas)

export interface Food {
  id: string
  name: string
  brand: string | null // marca del producto envasado
  barcode: string | null // código de barras (EAN/GTIN) solo con dígitos
  source: FoodSource
  per100g: NutritionValues
  unit: FoodUnit | null
  isFavorite: boolean // marcado con ⭐ por el usuario
  useCount: number // cuántas veces se ha registrado en el diario
  useCountByMeal: Partial<Record<MealType, number>> // ídem, pero desglosado por comida (desayuno, almuerzo...):
  // así "Frecuentes" en el buscador puede mostrar, para cada comida, lo que de verdad se usa ahí
  lastUsedAt: Date | null // última vez que se registró; null si nunca
  recipe: Recipe | null // solo las recetas; per100g y unit se calculan a partir de ella
  isPreparedDish: boolean // plato de restaurante ya terminado: se registra en el diario, pero no sirve de ingrediente
}

export interface FoodRepository {
  generateFoodId(): string
  subscribeFoods(onChange: (foods: Food[]) => void): () => void
  addFood(food: Food): void
  addFoods(foods: Food[]): void
  // Solo cambia nombre, marca, código, valores, unidad y receta; no toca favorito, uso ni fuente
  updateFood(food: Food): void
  deleteFood(id: string): void
  setFavorite(id: string, isFavorite: boolean): void
  // Suma un uso (total y de esa comida en particular) y actualiza la fecha de último uso
  markUsed(id: string, mealType: MealType): void
}
