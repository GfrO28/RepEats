import { MEAL_TYPES, BASE_MEAL_TYPES, type MealType } from './mealTypes'
import { sumNutrition, calculatePortionNutrition, type NutritionValues } from './foodNutrition'
import type { DiaryDay, DiaryItem, DiaryMeal } from '@/repositories/DiaryRepository'
import type { Food } from '@/repositories/FoodRepository'
import type { DailyIntake } from './adaptiveTdee'

export function createEmptyDay(date: string): DiaryDay {
  return { date, meals: [], hiddenMeals: [], mealTimes: {} }
}

// Una comida se ve si el usuario no la quitó ese día Y (es base, o está activada en el perfil, o el día
// ya tiene un registro de ella). En orden cronológico.
export function getVisibleMealTypes(day: DiaryDay | null, optionalMeals: readonly MealType[]): MealType[] {
  const hiddenTypes = day ? day.hiddenMeals : []
  const presentTypes = day ? day.meals.map((meal) => meal.type) : []
  return MEAL_TYPES.filter(
    (type) =>
      !hiddenTypes.includes(type) &&
      (BASE_MEAL_TYPES.includes(type) || optionalMeals.includes(type) || presentTypes.includes(type)),
  )
}

// Las comidas que hoy no se ven y se pueden agregar a este día
export function getAddableMealTypes(day: DiaryDay | null, optionalMeals: readonly MealType[]): MealType[] {
  const visibleTypes = getVisibleMealTypes(day, optionalMeals)
  return MEAL_TYPES.filter((type) => !visibleTypes.includes(type))
}

export function removeMealFromDay(day: DiaryDay, type: MealType): DiaryDay {
  return {
    ...day,
    meals: day.meals.filter((meal) => meal.type !== type),
    hiddenMeals: day.hiddenMeals.includes(type) ? day.hiddenMeals : [...day.hiddenMeals, type],
  }
}

export function addMealToDay(day: DiaryDay, type: MealType): DiaryDay {
  const alreadyThere = day.meals.some((meal) => meal.type === type)
  return {
    ...day,
    hiddenMeals: day.hiddenMeals.filter((hidden) => hidden !== type),
    meals: alreadyThere ? day.meals : [...day.meals, { type, items: [] }],
  }
}

export function addItemToDay(day: DiaryDay, type: MealType, item: DiaryItem): DiaryDay {
  const alreadyThere = day.meals.some((meal) => meal.type === type)
  const meals = alreadyThere
    ? day.meals.map((meal) => (meal.type === type ? { ...meal, items: [...meal.items, item] } : meal))
    : [...day.meals, { type, items: [item] }]
  return { ...day, meals }
}

export function getMealItems(day: DiaryDay | null, type: MealType): DiaryItem[] {
  return day?.meals.find((meal) => meal.type === type)?.items ?? []
}

// Agrega varios alimentos a una comida: la crea si no existía y la vuelve a mostrar si ese día se había quitado
export function addItemsToDay(day: DiaryDay, type: MealType, items: readonly DiaryItem[]): DiaryDay {
  if (items.length === 0) return day
  return items.reduce((current, item) => addItemToDay(current, type, item), addMealToDay(day, type))
}

// Copia a `target` todo lo registrado en `source`, comida por comida. Lo que ya había en `target` se conserva.
// Los ítems se copian con sus valores ya calculados, igual que al registrarlos.
export function copyDayInto(target: DiaryDay, source: DiaryDay): DiaryDay {
  return source.meals.reduce((current, meal) => addItemsToDay(current, meal.type, meal.items), target)
}

export function removeItemFromDay(day: DiaryDay, type: MealType, itemIndex: number): DiaryDay {
  return {
    ...day,
    meals: day.meals.map((meal) =>
      meal.type === type ? { ...meal, items: meal.items.filter((_, index) => index !== itemIndex) } : meal,
    ),
  }
}

// Cambia la cantidad (en gramos) de un ítem ya calculado, escalando sus kcal/macros en la misma proporción — sin
// volver a buscar el alimento original (que puede haber cambiado o borrarse; el ítem ya guarda su propia razón
// kcal/macros por gramo). Un ítem sin gramos (registro rápido histórico) no tiene de dónde escalar: se devuelve igual.
export function resizeDiaryItem(item: DiaryItem, grams: number): DiaryItem {
  if (item.grams === null || item.grams === 0) return item
  const ratio = grams / item.grams
  return {
    ...item,
    grams,
    nutrition: {
      kcal: item.nutrition.kcal * ratio,
      proteinG: item.nutrition.proteinG * ratio,
      fatG: item.nutrition.fatG * ratio,
      carbsG: item.nutrition.carbsG * ratio,
    },
  }
}

// Edita un ítem ya registrado (cambia de alimento, cantidad o valores), conservando su posición en la comida
export function replaceItemInDay(day: DiaryDay, type: MealType, itemIndex: number, item: DiaryItem): DiaryDay {
  return {
    ...day,
    meals: day.meals.map((meal) =>
      meal.type === type
        ? { ...meal, items: meal.items.map((existing, index) => (index === itemIndex ? item : existing)) }
        : meal,
    ),
  }
}

// Los valores se guardan ya calculados: si el alimento cambia o se borra, el historial no se altera
export function createItemFromFood(food: Food, grams: number): DiaryItem {
  return {
    foodId: food.id,
    name: food.name,
    grams,
    nutrition: calculatePortionNutrition(food.per100g, grams),
  }
}

export function calculateMealTotals(meal: DiaryMeal): NutritionValues {
  return sumNutrition(meal.items.map((item) => item.nutrition))
}

export function calculateDayTotals(day: DiaryDay | null): NutritionValues {
  if (!day) return sumNutrition([])
  return sumNutrition(day.meals.flatMap((meal) => meal.items.map((item) => item.nutrition)))
}

// Kcal totales de cada día (los días sin ningún registro salen con 0)
export function getDailyIntakes(days: readonly DiaryDay[]): DailyIntake[] {
  return days.map((day) => ({ date: day.date, kcal: calculateDayTotals(day).kcal }))
}
