// En orden cronológico: es el orden en que se muestran en el diario
export const MEAL_TYPES = ['breakfast', 'midMorning', 'lunch', 'midAfternoon', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  midMorning: 'Media mañana',
  lunch: 'Almuerzo',
  midAfternoon: 'Media tarde',
  dinner: 'Cena',
  snack: 'Snack',
}

// Siempre visibles en el diario
export const BASE_MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner']

// Se pueden agregar o quitar en cada día
export const OPTIONAL_MEAL_TYPES: readonly MealType[] = MEAL_TYPES.filter((type) => !BASE_MEAL_TYPES.includes(type))
