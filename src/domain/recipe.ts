import type { Food, Recipe, RecipeIngredient } from '@/repositories/FoodRepository'
import { calculatePortionNutrition, sumNutrition, type NutritionValues } from './foodNutrition'
import { searchFoods } from './foodPicker'

// Un ingrediente mientras se arma la receta: guarda los valores por 100 g para poder cambiar los gramos
export interface RecipeLine {
  foodId: string | null
  name: string
  per100g: NutritionValues
  grams: number
}

export interface RecipeSummary {
  rawGrams: number // suma de los ingredientes tal como se pesaron
  total: NutritionValues // de toda la receta
  per100g: NutritionValues // por 100 g de receta ya cocida
  servingGrams: number | null
  perServing: NutritionValues | null
}

const ZERO: NutritionValues = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
const round2 = (value: number) => Math.round(value * 100) / 100

function scaleNutrition(values: NutritionValues, factor: number): NutritionValues {
  return {
    kcal: values.kcal * factor,
    proteinG: values.proteinG * factor,
    fatG: values.fatG * factor,
    carbsG: values.carbsG * factor,
  }
}

// Al cocinar el peso cambia (el arroz absorbe agua, la carne la pierde), pero las calorías no:
// por eso los valores por 100 g se reparten sobre el peso FINAL cocido, no sobre la suma de ingredientes.
export function calculateRecipe(lines: readonly RecipeLine[], cookedGrams: number, servings: number | null): RecipeSummary {
  const total = sumNutrition(lines.map((line) => calculatePortionNutrition(line.per100g, line.grams)))
  const rawGrams = lines.reduce((sum, line) => sum + line.grams, 0)
  const per100g = cookedGrams > 0 ? scaleNutrition(total, 100 / cookedGrams) : ZERO

  const hasServings = servings !== null && servings > 0 && cookedGrams > 0
  return {
    rawGrams,
    total,
    per100g,
    servingGrams: hasServings ? cookedGrams / servings : null,
    perServing: hasServings ? scaleNutrition(total, 1 / servings) : null,
  }
}

// Proteína + grasa + carbohidratos no pueden pesar más que la receta cocida entera
// (pasaría, por ejemplo, si el peso final se anota demasiado bajo)
export function isRecipeWeightPlausible(total: NutritionValues, cookedGrams: number): boolean {
  return total.proteinG + total.fatG + total.carbsG <= cookedGrams + 1e-9
}

export function toRecipeIngredients(lines: readonly RecipeLine[]): RecipeIngredient[] {
  return lines.map((line) => ({
    foodId: line.foodId,
    name: line.name,
    grams: line.grams,
    nutrition: calculatePortionNutrition(line.per100g, line.grams),
  }))
}

// Alimentos que se pueden agregar como ingrediente: los que coinciden con la búsqueda, sin los platos de
// restaurante (ya son un plato terminado: contarían dos veces sus ingredientes) ni la propia receta
export function searchIngredients(foods: readonly Food[], query: string, excludedId: string | null): Food[] {
  return searchFoods(
    foods.filter((food) => !food.isPreparedDish && food.id !== excludedId),
    query,
  )
}

// Al editar una receta guardada se recupera el "por 100 g" de cada ingrediente a partir de lo que se guardó
export function linesFromRecipe(recipe: Recipe): RecipeLine[] {
  return recipe.ingredients.map((ingredient) => ({
    foodId: ingredient.foodId,
    name: ingredient.name,
    grams: ingredient.grams,
    per100g: ingredient.grams > 0 ? scaleNutrition(ingredient.nutrition, 100 / ingredient.grams) : ZERO,
  }))
}

interface RecipeFoodInput {
  id: string
  name: string
  lines: readonly RecipeLine[]
  cookedGrams: number
  servings: number | null
  previous: Food | null // al editar: se conservan favorito y uso
}

// La receta se guarda como un alimento más: así aparece en la búsqueda, en favoritos y admite gramos
export function createRecipeFood({ id, name, lines, cookedGrams, servings, previous }: RecipeFoodInput): Food {
  const summary = calculateRecipe(lines, cookedGrams, servings)

  return {
    id,
    name: name.trim(),
    brand: null,
    barcode: null,
    source: 'manual',
    per100g: {
      kcal: round2(summary.per100g.kcal),
      proteinG: round2(summary.per100g.proteinG),
      fatG: round2(summary.per100g.fatG),
      carbsG: round2(summary.per100g.carbsG),
    },
    unit: summary.servingGrams !== null ? { label: 'porción', grams: round2(summary.servingGrams) } : null,
    isFavorite: previous?.isFavorite ?? false,
    useCount: previous?.useCount ?? 0,
    useCountByMeal: previous?.useCountByMeal ?? {},
    lastUsedAt: previous?.lastUsedAt ?? null,
    recipe: { ingredients: toRecipeIngredients(lines), cookedGrams, servings },
    isPreparedDish: false,
  }
}
